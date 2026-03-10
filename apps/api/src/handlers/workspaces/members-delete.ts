import type { APIGatewayProxyHandler } from "aws-lambda";
import { DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { canManageApproval, type Role } from "../../auth/rbac";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";
import { countWorkspaceOwners } from "../../workspaces/members";

type Body = {
  workspaceId?: string;
};

type MembershipRow = {
  PK: string;
  SK: string;
  role?: Role;
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

  try {
    const authed = await getUserFromAccessToken(token);
    const actorUserId = authed.sub ?? authed.username;

    if (targetUserId === actorUserId) {
      return badRequest("Não é permitido remover sua própria membership.");
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

    if (actorMembership.role === "ADMIN" && target.role === "OWNER") {
      return unauthorized("ADMIN não pode remover OWNER.");
    }

    if (target.role === "OWNER") {
      if (actorMembership.role !== "OWNER") {
        return unauthorized("Apenas OWNER pode remover outro OWNER.");
      }
      const ownerCount = await countWorkspaceOwners({ ddb, tableName, workspaceId });
      if (ownerCount <= 1) {
        return badRequest("Não é possível remover o último OWNER do workspace.");
      }
    }

    await ddb.send(
      new DeleteCommand({
        TableName: tableName,
        Key: {
          PK: `USER#${targetUserId}`,
          SK: `WORKSPACE#${workspaceId}`,
        },
      }),
    );

    return json(200, { ok: true, userId: targetUserId });
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível remover o membro do workspace.");
  }
};
