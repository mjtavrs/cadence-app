import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { canWrite } from "../../auth/rbac";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type Body = {
  workspaceId?: string;
  reason?: string;
};

const MAX_FLAG_REASON_LENGTH = 500;

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  const postId = event.pathParameters?.id?.trim();
  if (!postId) return badRequest("id é obrigatório.");

  let body: Body = {};
  try {
    body = event.body ? (JSON.parse(event.body) as Body) : {};
  } catch {
    return badRequest("Body inválido (JSON).");
  }

  const workspaceId = body.workspaceId?.trim();
  const reason = body.reason?.trim() ?? "";

  if (!workspaceId) return badRequest("workspaceId é obrigatório.");
  if (!reason) return badRequest("Informe o motivo da sinalização.");
  if (reason.length > MAX_FLAG_REASON_LENGTH) {
    return badRequest(`O motivo deve ter no máximo ${MAX_FLAG_REASON_LENGTH} caracteres.`);
  }

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");
    if (!canWrite(membership.role)) return unauthorized("Sem permissão para sinalizar posts.");

    const ddb = getDocClient();
    const tableName = getTableName();
    const key = { PK: `WORKSPACE#${workspaceId}`, SK: `POST#${postId}` };

    const existing = await ddb.send(new GetCommand({ TableName: tableName, Key: key }));
    if (!existing.Item) return badRequest("Post não encontrado.");

    const now = new Date().toISOString();
    const flaggedByLabel = authed.email?.trim() || authed.username;

    await ddb.send(
      new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression:
          "SET #flaggedAt = :flaggedAt, #flaggedByUserId = :flaggedByUserId, #flaggedByLabel = :flaggedByLabel, #flagReason = :flagReason, #updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#flaggedAt": "flaggedAt",
          "#flaggedByUserId": "flaggedByUserId",
          "#flaggedByLabel": "flaggedByLabel",
          "#flagReason": "flagReason",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":flaggedAt": now,
          ":flaggedByUserId": userId,
          ":flaggedByLabel": flaggedByLabel,
          ":flagReason": reason,
          ":updatedAt": now,
        },
      }),
    );

    return json(200, {
      ok: true,
      flaggedAt: now,
      flaggedByUserId: userId,
      flaggedByLabel,
      flagReason: reason,
    });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível sinalizar o post agora.");
  }
};
