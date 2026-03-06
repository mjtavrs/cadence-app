import type { APIGatewayProxyHandler } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type FolderRow = {
  folderId: string;
  name?: string | null;
  parentFolderId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  const workspaceId = event.queryStringParameters?.workspaceId?.trim();
  if (!workspaceId) return badRequest("workspaceId e obrigatorio.");

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");

    const ddb = getDocClient();
    const tableName = getTableName();

    const res = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `WORKSPACE#${workspaceId}`,
          ":skPrefix": "FOLDER#",
        },
      }),
    );

    const folders = ((res.Items ?? []) as FolderRow[])
      .map((folder) => ({
        id: folder.folderId,
        name: folder.name?.trim() || "Pasta sem título",
        parentFolderId: folder.parentFolderId ?? null,
        createdAt: folder.createdAt ?? null,
        updatedAt: folder.updatedAt ?? null,
      }))
      .sort((a, b) => {
        const byName = a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
        if (byName !== 0) return byName;
        return String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""));
      });

    return json(200, { items: folders });
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAuthorizedException") return unauthorized("Sessao expirada. Faca login novamente.");
    return serverError("Nao foi possivel listar as pastas agora.");
  }
};
