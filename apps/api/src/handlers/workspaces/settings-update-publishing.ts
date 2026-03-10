import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { canManageApproval } from "../../auth/rbac";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";
import { parseMvpPostChannelsInput } from "../../posts/channels";
import { normalizeWorkspaceSettings, workspaceSettingsKey } from "../../workspaces/settings";

type Body = {
  workspaceId?: string;
  requireApprovalForContributors?: boolean;
  defaultChannels?: unknown;
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

  const hasRequireApproval = Object.prototype.hasOwnProperty.call(body, "requireApprovalForContributors");
  const hasDefaultChannels = Object.prototype.hasOwnProperty.call(body, "defaultChannels");
  if (!hasRequireApproval && !hasDefaultChannels) {
    return badRequest("Informe ao menos um campo para atualizar.");
  }

  if (hasRequireApproval && typeof body.requireApprovalForContributors !== "boolean") {
    return badRequest("requireApprovalForContributors inválido.");
  }

  const parsedChannels = hasDefaultChannels ? parseMvpPostChannelsInput(body.defaultChannels) : null;
  if (parsedChannels && !parsedChannels.ok) {
    return badRequest(parsedChannels.message);
  }

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");
    if (!canManageApproval(membership.role)) return unauthorized("Sem permissão para alterar configurações.");

    const ddb = getDocClient();
    const tableName = getTableName();
    const key = workspaceSettingsKey(workspaceId);

    const existingRes = await ddb.send(new GetCommand({ TableName: tableName, Key: key }));
    const existing = normalizeWorkspaceSettings(existingRes.Item);

    const now = new Date().toISOString();

    const nextPublishing = {
      requireApprovalForContributors: hasRequireApproval
        ? body.requireApprovalForContributors!
        : existing.publishing.requireApprovalForContributors,
      defaultChannels: parsedChannels?.ok ? parsedChannels.channels : existing.publishing.defaultChannels,
    };

    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          ...key,
          general: existing.general,
          publishing: nextPublishing,
          notifications: existing.notifications,
          createdAt: existing.createdAt ?? now,
          updatedAt: now,
          updatedByUserId: userId,
        },
      }),
    );

    return json(200, { ok: true, publishing: nextPublishing, updatedAt: now, updatedByUserId: userId });
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível atualizar as configurações de publicação.");
  }
};
