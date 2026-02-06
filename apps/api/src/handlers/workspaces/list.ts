import type { APIGatewayProxyHandler } from "aws-lambda";
import { QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { getDocClient, getTableName } from "../../db/dynamo";
import { json, serverError, unauthorized } from "../../http/responses";

type Role = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

type WorkspaceMembershipItem = {
  PK: string;
  SK: string;
  workspaceId: string;
  workspaceName: string;
  role: Role;
};

type UserProfileItem = {
  PK: string;
  SK: "PROFILE";
  activeWorkspaceId?: string;
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const ddb = getDocClient();
    const tableName = getTableName();

    const pk = `USER#${userId}`;

    const [profileRes, membershipsRes] = await Promise.all([
      ddb.send(
        new GetCommand({
          TableName: tableName,
          Key: { PK: pk, SK: "PROFILE" },
        }),
      ),
      ddb.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
          ExpressionAttributeValues: {
            ":pk": pk,
            ":skPrefix": "WORKSPACE#",
          },
        }),
      ),
    ]);

    const profile = profileRes.Item as UserProfileItem | undefined;
    const memberships = (membershipsRes.Items ?? []) as WorkspaceMembershipItem[];

    return json(200, {
      activeWorkspaceId: profile?.activeWorkspaceId ?? null,
      workspaces: memberships.map((m) => ({
        id: m.workspaceId,
        name: m.workspaceName,
        role: m.role,
      })),
    });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") {
      return unauthorized("Sessão expirada. Faça login novamente.");
    }
    return serverError("Não foi possível carregar workspaces agora.");
  }
};

