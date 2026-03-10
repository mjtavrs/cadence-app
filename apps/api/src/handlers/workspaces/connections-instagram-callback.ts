import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { canManageApproval } from "../../auth/rbac";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";
import {
  instagramConnectionKey,
  normalizeInstagramConnection,
  type InstagramConnectionStatus,
} from "../../workspaces/connections";

type Body = {
  workspaceId?: string;
  code?: string;
  state?: string;
  accountId?: string;
  accountUsername?: string;
  tokenExpiresAt?: string;
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  let body: Body;
  try {
    body = event.body ? (JSON.parse(event.body) as Body) : {};
  } catch {
    return badRequest("Body inválido (JSON).");
  }

  const workspaceId = body.workspaceId?.trim();
  if (!workspaceId) return badRequest("workspaceId é obrigatório.");

  const code = body.code?.trim();
  const state = body.state?.trim();
  const accountId = body.accountId?.trim() || null;
  const accountUsername = body.accountUsername?.trim() || null;
  const tokenExpiresAt = body.tokenExpiresAt?.trim() || null;

  if (!code && !accountId && !accountUsername) {
    return badRequest("Informe code ou dados da conta para concluir a conexão.");
  }

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");
    if (!canManageApproval(membership.role)) return unauthorized("Sem permissão para conectar redes sociais.");

    const ddb = getDocClient();
    const tableName = getTableName();
    const key = instagramConnectionKey(workspaceId);

    const existingRes = await ddb.send(new GetCommand({ TableName: tableName, Key: key }));
    const existing = (existingRes.Item ?? {}) as Record<string, unknown>;
    const existingStatus = typeof existing.status === "string" ? (existing.status as InstagramConnectionStatus) : null;
    const existingState = typeof existing.oauthState === "string" ? existing.oauthState : null;

    if (existingStatus === "PENDING" && existingState && state !== existingState) {
      return badRequest("State inválido para concluir a conexão do Instagram.");
    }

    const now = new Date().toISOString();

    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          ...key,
          provider: "INSTAGRAM",
          status: "CONNECTED",
          oauthState: null,
          connectedAt:
            typeof existing.connectedAt === "string" && existing.connectedAt ? existing.connectedAt : now,
          disconnectedAt: null,
          accountId,
          accountUsername,
          tokenExpiresAt,
          lastError: null,
          oauthCodeReceivedAt: code ? now : existing.oauthCodeReceivedAt ?? null,
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
    return serverError("Não foi possível concluir a conexão com o Instagram.");
  }
};
