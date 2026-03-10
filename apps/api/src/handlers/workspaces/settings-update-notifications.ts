import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { canManageApproval } from "../../auth/rbac";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";
import { normalizeWorkspaceSettings, workspaceSettingsKey } from "../../workspaces/settings";

type Body = {
  workspaceId?: string;
  emailOnPendingApproval?: boolean;
  emailOnScheduled?: boolean;
  emailOnPublished?: boolean;
  emailOnFailed?: boolean;
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

  const hasPendingApproval = Object.prototype.hasOwnProperty.call(body, "emailOnPendingApproval");
  const hasScheduled = Object.prototype.hasOwnProperty.call(body, "emailOnScheduled");
  const hasPublished = Object.prototype.hasOwnProperty.call(body, "emailOnPublished");
  const hasFailed = Object.prototype.hasOwnProperty.call(body, "emailOnFailed");

  if (!hasPendingApproval && !hasScheduled && !hasPublished && !hasFailed) {
    return badRequest("Informe ao menos um campo para atualizar.");
  }

  if (hasPendingApproval && typeof body.emailOnPendingApproval !== "boolean") {
    return badRequest("emailOnPendingApproval inválido.");
  }
  if (hasScheduled && typeof body.emailOnScheduled !== "boolean") {
    return badRequest("emailOnScheduled inválido.");
  }
  if (hasPublished && typeof body.emailOnPublished !== "boolean") {
    return badRequest("emailOnPublished inválido.");
  }
  if (hasFailed && typeof body.emailOnFailed !== "boolean") {
    return badRequest("emailOnFailed inválido.");
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

    const nextNotifications = {
      emailOnPendingApproval: hasPendingApproval
        ? body.emailOnPendingApproval!
        : existing.notifications.emailOnPendingApproval,
      emailOnScheduled: hasScheduled ? body.emailOnScheduled! : existing.notifications.emailOnScheduled,
      emailOnPublished: hasPublished ? body.emailOnPublished! : existing.notifications.emailOnPublished,
      emailOnFailed: hasFailed ? body.emailOnFailed! : existing.notifications.emailOnFailed,
    };

    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          ...key,
          general: existing.general,
          publishing: existing.publishing,
          notifications: nextNotifications,
          createdAt: existing.createdAt ?? now,
          updatedAt: now,
          updatedByUserId: userId,
        },
      }),
    );

    return json(200, { ok: true, notifications: nextNotifications, updatedAt: now, updatedByUserId: userId });
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível atualizar as configurações de notificação.");
  }
};
