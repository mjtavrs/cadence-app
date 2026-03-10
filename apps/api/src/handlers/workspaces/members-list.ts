import type { APIGatewayProxyHandler } from "aws-lambda";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";
import { listWorkspaceMembers, loadProfilesByUserId, roleSortWeight } from "../../workspaces/members";

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

    const members = await listWorkspaceMembers({ ddb, tableName, workspaceId });
    const profiles = await loadProfilesByUserId({
      ddb,
      tableName,
      userIds: members.map((member) => member.userId),
    });

    const items = members
      .map((member) => {
        const profile = profiles.get(member.userId);
        return {
          userId: member.userId,
          role: member.role,
          name: profile?.name ?? null,
          email: profile?.email ?? null,
          avatar: profile?.avatar ?? null,
          workspaceName: member.workspaceName,
          isCurrentUser: member.userId === userId,
        };
      })
      .sort((a, b) => {
        const byRole = roleSortWeight(a.role) - roleSortWeight(b.role);
        if (byRole !== 0) return byRole;

        const left = (a.name ?? a.email ?? a.userId).toLocaleLowerCase("pt-BR");
        const right = (b.name ?? b.email ?? b.userId).toLocaleLowerCase("pt-BR");
        return left.localeCompare(right, "pt-BR");
      });

    return json(200, { items });
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível listar os membros agora.");
  }
};
