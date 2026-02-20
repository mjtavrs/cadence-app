import type { APIGatewayProxyHandler } from "aws-lambda";
import { QueryCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { deleteObject } from "../../media/s3";
import { MEDIA } from "../../media/limits";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type MediaRow = {
  PK: string;
  SK: string;
  mediaId: string;
  s3Key: string;
};

type DeleteBatchBody = {
  workspaceId?: string;
  mediaIds?: string[];
};

const MAX_ITEMS_PER_BATCH = 25;

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  let body: DeleteBatchBody = {};
  try {
    body = event.body ? (JSON.parse(event.body) as DeleteBatchBody) : {};
  } catch {
    return badRequest("Body inválido (JSON).");
  }

  const workspaceId = body.workspaceId?.trim();
  const mediaIds = body.mediaIds ?? [];

  if (!workspaceId) return badRequest("workspaceId é obrigatório.");
  if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
    return badRequest("mediaIds deve ser um array não vazio.");
  }
  if (mediaIds.length > MAX_ITEMS_PER_BATCH) {
    return badRequest(`Máximo de ${MAX_ITEMS_PER_BATCH} itens por batch.`);
  }

  const uniqueIds = [...new Set(mediaIds.map((id) => id?.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return badRequest("Nenhum mediaId válido.");

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");

    const ddb = getDocClient();
    const tableName = getTableName();

    const res = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `WORKSPACE#${workspaceId}`,
          ":skPrefix": "MEDIA#",
        },
        ScanIndexForward: false,
        Limit: MEDIA.maxItemsPerWorkspace,
      }),
    );

    const rows = (res.Items ?? []) as MediaRow[];
    const byId = new Map<string, MediaRow>();
    for (const row of rows) byId.set(row.mediaId, row);

    const toDelete: MediaRow[] = [];
    const errors: Array<{ mediaId: string; message: string }> = [];
    for (const id of uniqueIds) {
      const row = byId.get(id);
      if (!row) {
        errors.push({ mediaId: id, message: "Mídia não encontrada." });
        continue;
      }
      toDelete.push(row);
    }

    if (toDelete.length === 0) {
      return json(400, { message: "Nenhum item encontrado para excluir.", errors });
    }

    const deleteRequests = toDelete.map((row) => ({
      DeleteRequest: { Key: { PK: row.PK, SK: row.SK } },
    }));

    await ddb.send(
      new BatchWriteCommand({
        RequestItems: { [tableName]: deleteRequests },
      }),
    );

    await Promise.all(toDelete.map((row) => deleteObject({ key: row.s3Key })));

    const deleted = toDelete.map((r) => r.mediaId);
    const response: { deleted: string[]; errors?: Array<{ mediaId: string; message: string }> } = {
      deleted,
    };
    if (errors.length > 0) response.errors = errors;

    return json(200, response);
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível excluir as mídias agora.");
  }
};
