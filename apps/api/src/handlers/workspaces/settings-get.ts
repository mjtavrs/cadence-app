import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";
import { signGetObject } from "../../media/s3";
import { normalizeWorkspaceSettings, workspaceSettingsKey } from "../../workspaces/settings";

async function resolveWorkspaceLogoUrl(workspaceLogoKey: string | null) {
  if (!workspaceLogoKey) return null;
  try {
    return await signGetObject({ key: workspaceLogoKey, expiresSeconds: 900 });
  } catch {
    return null;
  }
}

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

    const ddb = getDocClient();
    const tableName = getTableName();
    const res = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: workspaceSettingsKey(workspaceId),
      }),
    );

    const settings = normalizeWorkspaceSettings(res.Item);
    const workspaceLogoUrl = await resolveWorkspaceLogoUrl(settings.general.workspaceLogoKey);

    return json(200, {
      general: {
        ...settings.general,
        workspaceLogoUrl,
      },
      publishing: settings.publishing,
      notifications: settings.notifications,
      updatedAt: settings.updatedAt,
      updatedByUserId: settings.updatedByUserId,
    });
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível carregar as configurações agora.");
  }
};
