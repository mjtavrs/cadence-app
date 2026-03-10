import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { canManageApproval } from "../../auth/rbac";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";
import { signGetObject } from "../../media/s3";
import { normalizeWorkspaceSettings, workspaceSettingsKey } from "../../workspaces/settings";

type Body = {
  workspaceId?: string;
  workspaceName?: string | null;
  workspaceLogoKey?: string | null;
  timezone?: string;
  locale?: string;
};

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

  let body: Body;
  try {
    body = event.body ? (JSON.parse(event.body) as Body) : {};
  } catch {
    return badRequest("Body inválido (JSON).");
  }

  const workspaceId = body.workspaceId?.trim();
  if (!workspaceId) return badRequest("workspaceId é obrigatório.");

  const hasWorkspaceName = Object.prototype.hasOwnProperty.call(body, "workspaceName");
  const hasWorkspaceLogoKey = Object.prototype.hasOwnProperty.call(body, "workspaceLogoKey");
  const hasTimezone = Object.prototype.hasOwnProperty.call(body, "timezone");
  const hasLocale = Object.prototype.hasOwnProperty.call(body, "locale");
  if (!hasWorkspaceName && !hasWorkspaceLogoKey && !hasTimezone && !hasLocale) {
    return badRequest("Informe ao menos um campo para atualizar.");
  }

  const workspaceName =
    hasWorkspaceName && typeof body.workspaceName === "string" ? body.workspaceName.trim() : body.workspaceName;
  const workspaceLogoKey =
    hasWorkspaceLogoKey && typeof body.workspaceLogoKey === "string"
      ? body.workspaceLogoKey.trim()
      : body.workspaceLogoKey;
  const timezone = hasTimezone && typeof body.timezone === "string" ? body.timezone.trim() : undefined;
  const locale = hasLocale && typeof body.locale === "string" ? body.locale.trim() : undefined;

  if (hasWorkspaceName && body.workspaceName !== null && typeof body.workspaceName !== "string") {
    return badRequest("workspaceName inválido.");
  }
  if (hasWorkspaceLogoKey && body.workspaceLogoKey !== null && typeof body.workspaceLogoKey !== "string") {
    return badRequest("workspaceLogoKey inválido.");
  }
  if (hasTimezone && (!timezone || timezone.length > 80)) return badRequest("timezone inválido.");
  if (hasLocale && (!locale || locale.length > 20)) return badRequest("locale inválido.");
  if (typeof workspaceName === "string" && workspaceName.length > 100) return badRequest("workspaceName inválido.");
  if (typeof workspaceLogoKey === "string" && workspaceLogoKey.length > 400) {
    return badRequest("workspaceLogoKey inválido.");
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

    const nextGeneral = {
      workspaceName:
        hasWorkspaceName && body.workspaceName === null
          ? null
          : hasWorkspaceName
            ? (workspaceName as string)
            : existing.general.workspaceName,
      workspaceLogoKey:
        hasWorkspaceLogoKey && body.workspaceLogoKey === null
          ? null
          : hasWorkspaceLogoKey
            ? (workspaceLogoKey as string)
            : existing.general.workspaceLogoKey,
      timezone: hasTimezone ? (timezone as string) : existing.general.timezone,
      locale: hasLocale ? (locale as string) : existing.general.locale,
    };

    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          ...key,
          general: nextGeneral,
          publishing: existing.publishing,
          notifications: existing.notifications,
          createdAt: existing.createdAt ?? now,
          updatedAt: now,
          updatedByUserId: userId,
        },
      }),
    );

    const workspaceLogoUrl = await resolveWorkspaceLogoUrl(nextGeneral.workspaceLogoKey);

    return json(200, {
      ok: true,
      general: {
        ...nextGeneral,
        workspaceLogoUrl,
      },
      updatedAt: now,
      updatedByUserId: userId,
    });
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível atualizar as configurações gerais.");
  }
};
