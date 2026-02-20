import type { APIGatewayProxyHandler } from "aws-lambda";
import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { MEDIA } from "../../media/limits";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type MediaItemInput = {
  mediaId?: string;
  s3Key?: string;
  contentType?: string;
  sizeBytes?: number;
  fileName?: string;
};

type CreateBatchBody = {
  workspaceId?: string;
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
    return badRequest("Body inválido (JSON).");
  }

  const workspaceId = body.workspaceId?.trim();
  const items = body.items ?? [];

  if (!workspaceId) return badRequest("workspaceId é obrigatório.");
  if (!Array.isArray(items) || items.length === 0) {
    return badRequest("items deve ser um array não vazio.");
  }
  if (items.length > MAX_ITEMS_PER_BATCH) {
    return badRequest(`Máximo de ${MAX_ITEMS_PER_BATCH} itens por batch.`);
  }

  const errors: Array<{ mediaId: string; message: string }> = [];
  const validItems: MediaItemInput[] = [];

  for (const item of items) {
    const mediaId = item?.mediaId?.trim();
    const s3Key = item?.s3Key?.trim();
    const contentType = item?.contentType?.trim();
    const sizeBytes = item?.sizeBytes;

    if (!mediaId) {
      errors.push({ mediaId: item?.mediaId ?? "unknown", message: "mediaId é obrigatório." });
      continue;
    }
    if (!s3Key) {
      errors.push({ mediaId, message: "s3Key é obrigatório." });
      continue;
    }
    if (!contentType || !MEDIA.allowedContentTypes.has(contentType)) {
      errors.push({ mediaId, message: "contentType inválido." });
      continue;
    }
    if (typeof sizeBytes !== "number" || sizeBytes <= 0 || sizeBytes > MEDIA.maxBytes) {
      errors.push({ mediaId, message: "sizeBytes inválido." });
      continue;
    }

    validItems.push(item);
  }

  if (validItems.length === 0) {
    return json(400, { message: "Nenhum item válido encontrado.", errors });
  }

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");

    const ddb = getDocClient();
    const tableName = getTableName();
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
    const processedMediaIds = new Set<string>();

    if (batchResult.UnprocessedItems && Object.keys(batchResult.UnprocessedItems).length > 0) {
      const unprocessed = batchResult.UnprocessedItems[tableName] ?? [];
      const unprocessedIndices = new Set<number>();

      for (const unprocessedReq of unprocessed) {
        if (unprocessedReq.PutRequest) {
          const mediaId = unprocessedReq.PutRequest.Item.mediaId;
          const index = writeRequests.findIndex(
            (req) => req.PutRequest.Item.mediaId === mediaId,
          );
          if (index >= 0) {
            unprocessedIndices.add(index);
            errors.push({ mediaId, message: "Falha ao processar item. Tente novamente." });
          }
        }
      }

      for (let i = 0; i < validItems.length; i++) {
        if (!unprocessedIndices.has(i)) {
          const mediaId = validItems[i].mediaId!;
          created.push({ mediaId });
          processedMediaIds.add(mediaId);
        }
      }
    } else {
      for (const item of validItems) {
        created.push({ mediaId: item.mediaId! });
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
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível registrar a mídia agora.");
  }
};
