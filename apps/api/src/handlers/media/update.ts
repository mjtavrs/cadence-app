import type { APIGatewayProxyHandler } from "aws-lambda";
import { QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

const MAX_FILE_NAME_LENGTH = 255;

type MediaItem = {
  PK: string;
  SK: string;
  mediaId: string;
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  const workspaceId = event.queryStringParameters?.workspaceId?.trim();
  const mediaId = event.pathParameters?.id?.trim();
  if (!workspaceId) return badRequest("workspaceId é obrigatório.");
  if (!mediaId) return badRequest("id é obrigatório.");

  let body: { fileName?: unknown } = {};
  try {
    body = event.body ? (JSON.parse(event.body) as { fileName?: unknown }) : {};
  } catch {
    return badRequest("Body inválido (JSON).");
  }

  const rawFileName = body.fileName;
  if (typeof rawFileName !== "string") return badRequest("fileName é obrigatório.");
  const fileName = rawFileName.trim();
  if (!fileName) return badRequest("fileName não pode ser vazio.");
  if (fileName.length > MAX_FILE_NAME_LENGTH) return badRequest(`fileName deve ter no máximo ${MAX_FILE_NAME_LENGTH} caracteres.`);
  if (/[\0\/\\]/.test(fileName)) return badRequest("fileName contém caracteres inválidos.");

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
          ":skPrefix": "MEDIA#",
        },
        Limit: 30,
      }),
    );

    const items = (res.Items ?? []) as MediaItem[];
    const found = items.find((i) => i.mediaId === mediaId);
    if (!found) return json(404, { message: "Mídia não encontrada." });

    await ddb.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: found.PK, SK: found.SK },
        UpdateExpression: "SET fileName = :fileName",
        ExpressionAttributeValues: { ":fileName": fileName },
      }),
    );

    return json(200, { ok: true });
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível renomear a mídia agora.");
  }
};
