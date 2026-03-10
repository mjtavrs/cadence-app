import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { canManageApproval, type Role } from "../../auth/rbac";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";
import { countWorkspaceOwners, isRole } from "../../workspaces/members";

type Body = {
  workspaceId?: string;
  role?: string;
};

type MembershipRow = {
  PK: string;
  SK: string;
  role?: Role;
  workspaceName?: string;
  workspaceId?: string;
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  const targetUserId = event.pathParameters?.userId?.trim();
  if (!targetUserId) return badRequest("userId é obrigatório.");

  let body: Body;
  try {
    body = event.body ? (JSON.parse(event.body) as Body) : {};
  } catch {
    return badRequest("Body inválido (JSON).");
  }

  const workspaceId = body.workspaceId?.trim();
  if (!workspaceId) return badRequest("workspaceId é obrigatório.");

  const normalizedRole = typeof body.role === "string" ? body.role.trim().toUpperCase() : "";
  if (!isRole(normalizedRole)) return badRequest("role inválido.");
  const nextRole = normalizedRole as Role;

  try {
    const authed = await getUserFromAccessToken(token);
    const actorUserId = authed.sub ?? authed.username;

    if (targetUserId === actorUserId) {
      return badRequest("Não é permitido alterar sua própria role.");
    }

    const actorMembership = await assertWorkspaceMembership({ userId: actorUserId, workspaceId });
    if (!actorMembership) return unauthorized("Sem acesso ao workspace.");
    if (!canManageApproval(actorMembership.role)) return unauthorized("Sem permissão para gerenciar membros.");

    const ddb = getDocClient();
    const tableName = getTableName();

    const targetRes = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: {
          PK: `USER#${targetUserId}`,
          SK: `WORKSPACE#${workspaceId}`,
        },
      }),
    );

    const target = targetRes.Item as MembershipRow | undefined;
    if (!target || !target.role) return badRequest("Membro não encontrado.");

    if (target.role === nextRole) {
      return json(200, { ok: true, userId: targetUserId, role: target.role });
    }

    if (actorMembership.role === "ADMIN") {
      if (target.role === "OWNER" || nextRole === "OWNER") {
        return unauthorized("ADMIN não pode alterar roles de OWNER.");
      }
    }

    if (target.role === "OWNER" && nextRole !== "OWNER") {
      if (actorMembership.role !== "OWNER") {
        return unauthorized("Apenas OWNER pode alterar a role de outro OWNER.");
      }

      const ownerCount = await countWorkspaceOwners({ ddb, tableName, workspaceId });
      if (ownerCount <= 1) {
        return badRequest("Não é possível remover o último OWNER do workspace.");
      }
    }

    const now = new Date().toISOString();

    await ddb.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: `USER#${targetUserId}`,
          SK: `WORKSPACE#${workspaceId}`,
        },
        UpdateExpression: "SET #role = :role, #updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#role": "role",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":role": nextRole,
          ":updatedAt": now,
        },
      }),
    );

    return json(200, { ok: true, userId: targetUserId, role: nextRole, updatedAt: now });
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível atualizar a role do membro.");
  }
};
