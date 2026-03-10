import type { APIGatewayProxyHandler } from "aws-lambda";
import { BatchWriteCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";
import { MEDIA } from "../../media/limits";
import { normalizeFileName } from "../../media/names";
import { deleteObject } from "../../media/s3";

type MediaItemInput = {
  mediaId?: string;
  s3Key?: string;
  contentType?: string;
  sizeBytes?: number;
  fileName?: string;
  folderId?: string | null;
};

type CreateBatchBody = {
  workspaceId?: string;
  folderId?: string | null;
  items?: MediaItemInput[];
  dedupeMode?: "replace_by_name_ext";
};

const MAX_ITEMS_PER_BATCH = 25;
const REPLACE_BY_NAME_EXT = "replace_by_name_ext";

type ExistingMediaRow = {
  PK: string;
  SK: string;
  mediaId: string;
  s3Key: string;
  fileName?: string | null;
  folderId?: string | null;
  sizeBytes?: number;
};

function makeFileKey(folderId: string | null, fileName: string) {
  return `${folderId ?? "ROOT"}::${normalizeFileName(fileName)}`;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  let body: CreateBatchBody = {};
  try {
    body = event.body ? (JSON.parse(event.body) as CreateBatchBody) : {};
  } catch {
    return badRequest("Body invalido (JSON).");
  }

  const workspaceId = body.workspaceId?.trim();
  const fallbackFolderId = typeof body.folderId === "string" ? body.folderId.trim() : null;
  const dedupeMode = body.dedupeMode === REPLACE_BY_NAME_EXT ? REPLACE_BY_NAME_EXT : null;
  const items = body.items ?? [];

  if (!workspaceId) return badRequest("workspaceId e obrigatorio.");
  if (!Array.isArray(items) || items.length === 0) {
    return badRequest("items deve ser um array nao vazio.");
  }
  if (items.length > MAX_ITEMS_PER_BATCH) {
    return badRequest(`Maximo de ${MAX_ITEMS_PER_BATCH} itens por batch.`);
  }

  const errors: Array<{ mediaId: string; message: string }> = [];
  const validItems: MediaItemInput[] = [];

  for (const item of items) {
    const mediaId = item?.mediaId?.trim();
    const s3Key = item?.s3Key?.trim();
    const contentType = item?.contentType?.trim();
    const sizeBytes = item?.sizeBytes;
    const resolvedFolderId = typeof item?.folderId === "string" ? item.folderId.trim() : fallbackFolderId;

    if (!mediaId) {
      errors.push({ mediaId: item?.mediaId ?? "unknown", message: "mediaId e obrigatorio." });
      continue;
    }
    if (!s3Key) {
      errors.push({ mediaId, message: "s3Key e obrigatorio." });
      continue;
    }
    if (!contentType || !MEDIA.allowedContentTypes.has(contentType)) {
      errors.push({ mediaId, message: "contentType invalido." });
      continue;
    }
    if (typeof sizeBytes !== "number" || sizeBytes <= 0 || sizeBytes > MEDIA.maxBytes) {
      errors.push({ mediaId, message: "sizeBytes invalido." });
      continue;
    }

    validItems.push({
      ...item,
      folderId: resolvedFolderId || null,
    });
  }

  if (validItems.length === 0) {
    return json(400, { message: "Nenhum item valido encontrado.", errors });
  }

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");

    const ddb = getDocClient();
    const tableName = getTableName();

    const folderIds = [
      ...new Set(
        validItems
          .map((item) => (typeof item.folderId === "string" ? item.folderId.trim() : null))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    for (const folderId of folderIds) {
      const folderRes = await ddb.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            PK: `WORKSPACE#${workspaceId}`,
            SK: `FOLDER#${folderId}`,
          },
          ProjectionExpression: "folderId",
        }),
      );

      if (!folderRes.Item) return badRequest("Pasta nao encontrada.");
    }

    const existingQuery = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `WORKSPACE#${workspaceId}`,
          ":skPrefix": "MEDIA#",
        },
        ProjectionExpression: "PK, SK, mediaId, s3Key, fileName, folderId, sizeBytes",
        Limit: MEDIA.maxItemsPerWorkspace,
      }),
    );

    const existingItems = (existingQuery.Items ?? []) as ExistingMediaRow[];
    const existingCount = existingItems.length;
    const existingBytes = existingItems.reduce((sum, item) => {
      const size = (item as { sizeBytes?: unknown }).sizeBytes;
      return sum + (typeof size === "number" ? size : 0);
    }, 0);
    const incomingCount = validItems.length;
    const incomingBytes = validItems.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0);

    if (existingCount + incomingCount > MEDIA.maxItemsPerWorkspace) {
      const available = Math.max(0, MEDIA.maxItemsPerWorkspace - existingCount);
      return badRequest(
        `Limite de ${MEDIA.maxItemsPerWorkspace} imagens atingido. Voce pode fazer upload de ${available} arquivo(s).`,
      );
    }
    if (existingBytes + incomingBytes > MEDIA.maxBytesPerWorkspace) {
      const availableMb = Math.max(0, (MEDIA.maxBytesPerWorkspace - existingBytes) / (1024 * 1024));
      return badRequest(`Limite de armazenamento atingido. Restam ${availableMb.toFixed(1)}MB disponiveis no workspace.`);
    }

    const replacementsByNewMediaId = new Map<string, ExistingMediaRow>();
    if (dedupeMode === REPLACE_BY_NAME_EXT) {
      const existingByFolderAndName = new Map<string, ExistingMediaRow>();
      for (const existingItem of existingItems) {
        if (!existingItem.fileName?.trim()) continue;
        existingByFolderAndName.set(makeFileKey(existingItem.folderId ?? null, existingItem.fileName), existingItem);
      }

      for (const item of validItems) {
        const mediaId = item.mediaId?.trim();
        const incomingFileName = item.fileName?.trim();
        if (!mediaId || !incomingFileName) continue;

        const existingMatch = existingByFolderAndName.get(makeFileKey(item.folderId ?? null, incomingFileName));
        if (existingMatch) {
          replacementsByNewMediaId.set(mediaId, existingMatch);
        }
      }
    }

    const createdAt = new Date().toISOString();

    const writeRequests = validItems.map((item) => ({
      PutRequest: {
        Item: {
          PK: `WORKSPACE#${workspaceId}`,
          SK: `MEDIA#${createdAt}#${item.mediaId}`,
          mediaId: item.mediaId,
          workspaceId,
          contentType: item.contentType,
          sizeBytes: item.sizeBytes,
          fileName: item.fileName?.trim() || null,
          folderId: item.folderId ?? null,
          s3Key: item.s3Key,
          createdAt,
        },
      },
    }));

    const batchResult = await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: writeRequests,
        },
      }),
    );

    const created: Array<{ mediaId: string }> = [];

    if (batchResult.UnprocessedItems && Object.keys(batchResult.UnprocessedItems).length > 0) {
      const unprocessed = batchResult.UnprocessedItems[tableName] ?? [];
      const unprocessedMediaIds = new Set<string>();

      for (const unprocessedReq of unprocessed) {
        const mediaId = unprocessedReq.PutRequest?.Item?.mediaId;
        if (typeof mediaId !== "string") continue;

        unprocessedMediaIds.add(mediaId);
        errors.push({ mediaId, message: "Falha ao processar item. Tente novamente." });
      }

      for (const item of validItems) {
        const mediaId = item.mediaId;
        if (!mediaId || unprocessedMediaIds.has(mediaId)) continue;
        created.push({ mediaId });
      }
    } else {
      for (const item of validItems) {
        const mediaId = item.mediaId;
        if (!mediaId) continue;
        created.push({ mediaId });
      }
    }

    const response: {
      created: Array<{ mediaId: string }>;
      replacedMediaIds?: string[];
      errors?: Array<{ mediaId: string; message: string }>;
    } = { created };

    if (created.length > 0 && replacementsByNewMediaId.size > 0) {
      const createdIds = new Set(created.map((item) => item.mediaId));
      const oldToNewMediaId = new Map<string, string>();
      for (const [newMediaId, oldRow] of replacementsByNewMediaId.entries()) {
        oldToNewMediaId.set(oldRow.mediaId, newMediaId);
      }

      const rowsToDelete = Array.from(replacementsByNewMediaId.entries())
        .filter(([newMediaId]) => createdIds.has(newMediaId))
        .map(([, row]) => row);
      const uniqueRowsToDelete = Array.from(new Map(rowsToDelete.map((row) => [row.mediaId, row])).values());
      const replacedNewMediaIds = new Set<string>();

      for (const rowsChunk of chunk(uniqueRowsToDelete, MAX_ITEMS_PER_BATCH)) {
        const deleteRequests = rowsChunk.map((row) => ({
          DeleteRequest: {
            Key: {
              PK: row.PK,
              SK: row.SK,
            },
          },
        }));

        const deleteResult = await ddb.send(
          new BatchWriteCommand({
            RequestItems: {
              [tableName]: deleteRequests,
            },
          }),
        );

        const unprocessed = deleteResult.UnprocessedItems?.[tableName] ?? [];
        const unprocessedKeys = new Set(
          unprocessed
            .map((req) => `${req.DeleteRequest?.Key?.PK ?? ""}::${req.DeleteRequest?.Key?.SK ?? ""}`)
            .filter(Boolean),
        );

        for (const row of rowsChunk) {
          const key = `${row.PK}::${row.SK}`;
          if (unprocessedKeys.has(key)) {
            errors.push({
              mediaId: row.mediaId,
              message: "Falha ao substituir item antigo. Tente novamente.",
            });
            continue;
          }
          const newMediaId = oldToNewMediaId.get(row.mediaId);
          if (newMediaId) replacedNewMediaIds.add(newMediaId);
          try {
            await deleteObject({ key: row.s3Key });
          } catch {
            errors.push({
              mediaId: row.mediaId,
              message: "Item antigo removido do catalogo, mas falhou ao remover arquivo no storage.",
            });
          }
        }
      }

      if (replacedNewMediaIds.size > 0) {
        response.replacedMediaIds = Array.from(replacedNewMediaIds);
      }
    }

    if (errors.length > 0) {
      response.errors = errors;
    }

    return json(201, response);
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAuthorizedException") return unauthorized("Sessao expirada. Faca login novamente.");
    return serverError("Nao foi possivel registrar a midia agora.");
  }
};
