import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type Body = {
  name?: string;
};

const MAX_FOLDER_NAME_LENGTH = 80;

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  const workspaceId = event.queryStringParameters?.workspaceId?.trim();
  const folderId = event.pathParameters?.id?.trim();
  if (!workspaceId) return badRequest("workspaceId e obrigatorio.");
  if (!folderId) return badRequest("id e obrigatorio.");

  let body: Body = {};
  try {
    body = event.body ? (JSON.parse(event.body) as Body) : {};
  } catch {
    return badRequest("Body invalido (JSON).");
  }

  const name = body.name?.trim();
  if (!name) return badRequest("name e obrigatorio.");
  if (name.length > MAX_FOLDER_NAME_LENGTH) {
    return badRequest(`name deve ter no maximo ${MAX_FOLDER_NAME_LENGTH} caracteres.`);
  }

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
        ProjectionExpression: "folderId, parentFolderId, createdAt",
      }),
    );

    if (!folderRes.Item) return json(404, { message: "Pasta nao encontrada." });

    const updatedAt = new Date().toISOString();

    await ddb.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: `WORKSPACE#${workspaceId}`,
          SK: `FOLDER#${folderId}`,
        },
        UpdateExpression: "SET #name = :name, updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#name": "name",
        },
        ExpressionAttributeValues: {
          ":name": name,
          ":updatedAt": updatedAt,
        },
      }),
    );

    return json(200, {
      ok: true,
      id: folderId,
      name,
      parentFolderId:
        typeof folderRes.Item.parentFolderId === "string" ? folderRes.Item.parentFolderId : null,
      createdAt: typeof folderRes.Item.createdAt === "string" ? folderRes.Item.createdAt : null,
      updatedAt,
    });
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAuthorizedException") return unauthorized("Sessao expirada. Faca login novamente.");
    return serverError("Nao foi possivel renomear a pasta agora.");
  }
};
