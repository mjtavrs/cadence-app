import type { APIGatewayProxyHandler } from "aws-lambda";
import { QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { deleteObject } from "../../media/s3";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type MediaItem = {
  PK: string;
  SK: string;
  mediaId: string;
  s3Key: string;
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  const workspaceId = event.queryStringParameters?.workspaceId?.trim();
  const mediaId = event.pathParameters?.id?.trim();
  if (!workspaceId) return badRequest("workspaceId é obrigatório.");
  if (!mediaId) return badRequest("id é obrigatório.");

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");

    const ddb = getDocClient();
    const tableName = getTableName();

    // encontra item pelo mediaId (scan parcial via query e filtro leve; limitado a 30)
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
    if (!found) return badRequest("Mídia não encontrada.");

    await Promise.all([
      ddb.send(new DeleteCommand({ TableName: tableName, Key: { PK: found.PK, SK: found.SK } })),
      deleteObject({ key: found.s3Key }),
    ]);

    return json(200, { ok: true });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível deletar a mídia agora.");
  }
};

