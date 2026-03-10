import type { APIGatewayProxyHandler } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { canManageApproval } from "../../auth/rbac";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";
import { instagramConnectionKey } from "../../workspaces/connections";

type Body = {
  workspaceId?: string;
};

const DEFAULT_IG_OAUTH_BASE = "https://www.facebook.com/v21.0/dialog/oauth";
const DEFAULT_IG_SCOPE =
  "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management";

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

  const appId = process.env.INSTAGRAM_APP_ID?.trim();
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI?.trim();
  const oauthBase = process.env.INSTAGRAM_OAUTH_AUTHORIZE_URL?.trim() || DEFAULT_IG_OAUTH_BASE;
  const scope = process.env.INSTAGRAM_OAUTH_SCOPES?.trim() || DEFAULT_IG_SCOPE;

  if (!appId || !redirectUri) {
    return serverError("Integração do Instagram não configurada no backend.");
  }

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");
    if (!canManageApproval(membership.role)) return unauthorized("Sem permissão para conectar redes sociais.");

    const now = new Date().toISOString();
    const oauthState = randomUUID();

    const ddb = getDocClient();
    const tableName = getTableName();

    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          ...instagramConnectionKey(workspaceId),
          provider: "INSTAGRAM",
          status: "PENDING",
          oauthState,
          connectedAt: null,
          disconnectedAt: null,
          accountId: null,
          accountUsername: null,
          tokenExpiresAt: null,
          lastError: null,
          createdAt: now,
          updatedAt: now,
          updatedByUserId: userId,
        },
      }),
    );

    const authUrl = new URL(oauthBase);
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("state", oauthState);

    return json(200, {
      ok: true,
      provider: "INSTAGRAM",
      status: "PENDING",
      oauthState,
      authUrl: authUrl.toString(),
    });
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível iniciar a conexão com o Instagram.");
  }
};
