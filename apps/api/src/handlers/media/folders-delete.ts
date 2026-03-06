import type { APIGatewayProxyHandler } from "aws-lambda";
import { DeleteCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type FolderRow = {
  folderId?: string;
  parentFolderId?: string | null;
};

type MediaRow = {
  folderId?: string | null;
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  const workspaceId = event.queryStringParameters?.workspaceId?.trim();
  const folderId = event.pathParameters?.id?.trim();
  if (!workspaceId) return badRequest("workspaceId e obrigatorio.");
  if (!folderId) return badRequest("id e obrigatorio.");

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");

    const ddb = getDocClient();
    const tableName = getTableName();

    const folderRes = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: {
          PK: `WORKSPACE#${workspaceId}`,
          SK: `FOLDER#${folderId}`,
        },
        ProjectionExpression: "folderId",
      }),
    );

    if (!folderRes.Item) return json(404, { message: "Pasta nao encontrada." });

    const childrenRes = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `WORKSPACE#${workspaceId}`,
          ":skPrefix": "FOLDER#",
        },
      }),
    );

    const hasChildFolder = ((childrenRes.Items ?? []) as FolderRow[]).some(
      (item) => item.parentFolderId === folderId,
    );

    if (hasChildFolder) {
      return badRequest("A pasta possui subpastas e nao pode ser excluida.");
    }

    const mediaRes = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `WORKSPACE#${workspaceId}`,
          ":skPrefix": "MEDIA#",
        },
      }),
    );

    const hasMediaInside = ((mediaRes.Items ?? []) as MediaRow[]).some(
      (item) => item.folderId === folderId,
    );

    if (hasMediaInside) {
      return badRequest("A pasta possui arquivos e nao pode ser excluida.");
    }

    await ddb.send(
      new DeleteCommand({
        TableName: tableName,
        Key: {
          PK: `WORKSPACE#${workspaceId}`,
          SK: `FOLDER#${folderId}`,
        },
      }),
    );

    return json(200, { ok: true, id: folderId });
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAuthorizedException") return unauthorized("Sessao expirada. Faca login novamente.");
    return serverError("Nao foi possivel excluir a pasta agora.");
  }
};
