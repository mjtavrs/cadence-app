import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";
import { normalizePostChannels } from "../../posts/channels";

function normalizePublishedAt(item: Record<string, unknown>) {
  if (typeof item.publishedAt === "string" && item.publishedAt) return item.publishedAt;
  if (item.status === "PUBLISHED" && typeof item.updatedAt === "string" && item.updatedAt) return item.updatedAt;
  return null;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  const postId = event.pathParameters?.id?.trim();
  const workspaceId = event.queryStringParameters?.workspaceId?.trim();

  if (!workspaceId) return badRequest("workspaceId é obrigatório.");
  if (!postId) return badRequest("id é obrigatório.");

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");

    const ddb = getDocClient();
    const tableName = getTableName();

    const res = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: `WORKSPACE#${workspaceId}`, SK: `POST#${postId}` },
      }),
    );

    if (!res.Item) return badRequest("Post não encontrado.");

    const item = res.Item as Record<string, unknown>;
    return json(200, {
      ...item,
      channels: normalizePostChannels(item.channels),
      publishedAt: normalizePublishedAt(item),
    });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível carregar o post agora.");
  }
};

