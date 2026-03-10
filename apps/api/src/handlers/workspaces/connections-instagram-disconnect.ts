import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { canManageApproval } from "../../auth/rbac";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";
import { instagramConnectionKey, normalizeInstagramConnection } from "../../workspaces/connections";

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  const workspaceId = event.queryStringParameters?.workspaceId?.trim();
  if (!workspaceId) return badRequest("workspaceId é obrigatório.");

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");
    if (!canManageApproval(membership.role)) return unauthorized("Sem permissão para desconectar redes sociais.");

    const ddb = getDocClient();
    const tableName = getTableName();
    const key = instagramConnectionKey(workspaceId);

    const existingRes = await ddb.send(new GetCommand({ TableName: tableName, Key: key }));
    const existing = (existingRes.Item ?? {}) as Record<string, unknown>;

    const now = new Date().toISOString();

    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          ...key,
          provider: "INSTAGRAM",
          status: "DISCONNECTED",
          oauthState: null,
          connectedAt: null,
          disconnectedAt: now,
          accountId: null,
          accountUsername: null,
          tokenExpiresAt: null,
          lastError: null,
          createdAt:
            typeof existing.createdAt === "string" && existing.createdAt ? (existing.createdAt as string) : now,
          updatedAt: now,
          updatedByUserId: userId,
        },
      }),
    );

    const updatedRes = await ddb.send(new GetCommand({ TableName: tableName, Key: key }));
    const instagram = normalizeInstagramConnection(updatedRes.Item);

    return json(200, { ok: true, instagram });
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível desconectar o Instagram.");
  }
};
