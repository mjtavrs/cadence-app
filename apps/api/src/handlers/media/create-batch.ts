import type { APIGatewayProxyHandler } from "aws-lambda";
import { BatchWriteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";
import { MEDIA } from "../../media/limits";

type MediaItemInput = {
  mediaId?: string;
  s3Key?: string;
  contentType?: string;
  sizeBytes?: number;
  fileName?: string;
};

type CreateBatchBody = {
  workspaceId?: string;
  folderId?: string | null;
  items?: MediaItemInput[];
};

const MAX_ITEMS_PER_BATCH = 25;

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
  const folderId = typeof body.folderId === "string" ? body.folderId.trim() : null;
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

    validItems.push(item);
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

    if (folderId) {
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
          folderId,
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
      errors?: Array<{ mediaId: string; message: string }>;
    } = { created };

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
