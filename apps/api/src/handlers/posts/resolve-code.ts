import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  const workspaceId = event.queryStringParameters?.workspaceId?.trim();
  const codeRaw = event.queryStringParameters?.code ?? event.queryStringParameters?.shortCode;
  const code = (codeRaw ?? "").trim().toUpperCase();

  if (!workspaceId) return badRequest("workspaceId é obrigatório.");
  if (!code) return badRequest("code é obrigatório.");

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
        Key: { PK: `WORKSPACE#${workspaceId}`, SK: `POSTCODE#${code}` },
      }),
    );

    const item = res.Item as { postId?: string } | undefined;
    if (!item?.postId) return json(404, { message: "Código não encontrado." });

    return json(200, { postId: item.postId });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível resolver o código agora.");
  }
};

