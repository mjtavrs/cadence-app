import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { canWrite } from "../../auth/rbac";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type PostItem = {
  PK: string;
  SK: string;
  postId: string;
  shortCode?: string;
};

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
    if (!canWrite(membership.role)) return unauthorized("Sem permissão para deletar posts.");

    const ddb = getDocClient();
    const tableName = getTableName();
    const pk = `WORKSPACE#${workspaceId}`;

    const getRes = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: pk, SK: `POST#${postId}` },
      }),
    );

    const post = getRes.Item as PostItem | undefined;
    if (!post) return badRequest("Post não encontrado.");

    const shortCode = post.shortCode;

    const transactItems = [
      {
        Delete: {
          TableName: tableName,
          Key: { PK: pk, SK: `POST#${postId}` },
        },
      },
    ];

    if (shortCode) {
      transactItems.push({
        Delete: {
          TableName: tableName,
          Key: { PK: pk, SK: `POSTCODE#${shortCode}` },
        },
      });
    }

    await ddb.send(
      new TransactWriteCommand({
        TransactItems: transactItems,
      }),
    );

    return json(200, { ok: true });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível deletar o post agora.");
  }
};
