import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type Body = {
  workspaceId?: string;
  name?: string;
  parentFolderId?: string | null;
};

const DEFAULT_FOLDER_NAME = "Pasta sem título";
const MAX_FOLDER_NAME_LENGTH = 80;

function newFolderId() {
  return `fld_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  let body: Body = {};
  try {
    body = event.body ? (JSON.parse(event.body) as Body) : {};
  } catch {
    return badRequest("Body invalido (JSON).");
  }

  const workspaceId = body.workspaceId?.trim();
  const name = body.name?.trim() || DEFAULT_FOLDER_NAME;
  const parentFolderId = typeof body.parentFolderId === "string" ? body.parentFolderId.trim() : null;

  if (!workspaceId) return badRequest("workspaceId e obrigatorio.");
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

    if (parentFolderId) {
      const parentRes = await ddb.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            PK: `WORKSPACE#${workspaceId}`,
            SK: `FOLDER#${parentFolderId}`,
          },
          ProjectionExpression: "folderId",
        }),
      );

      if (!parentRes.Item) return badRequest("Pasta pai nao encontrada.");
    }

    const now = new Date().toISOString();
    const folderId = newFolderId();

    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: `WORKSPACE#${workspaceId}`,
          SK: `FOLDER#${folderId}`,
          folderId,
          workspaceId,
          name,
          parentFolderId,
          createdAt: now,
          updatedAt: now,
          createdByUserId: userId,
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      }),
    );

    return json(201, {
      id: folderId,
      name,
      parentFolderId,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAuthorizedException") return unauthorized("Sessao expirada. Faca login novamente.");
    return serverError("Nao foi possivel criar a pasta agora.");
  }
};
