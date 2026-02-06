import type { APIGatewayProxyHandler } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  let workspaceId: string | undefined;
  try {
    const body = event.body ? (JSON.parse(event.body) as { workspaceId?: string }) : {};
    workspaceId = body.workspaceId?.trim();
  } catch {
    return badRequest("Body inválido (JSON).");
  }

  if (!workspaceId) return badRequest("workspaceId é obrigatório.");

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;
    const pk = `USER#${userId}`;

    const ddb = getDocClient();
    const tableName = getTableName();

    // Apenas grava preferência; validação de pertencimento pode ser adicionada depois.
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: pk,
          SK: "PROFILE",
          activeWorkspaceId: workspaceId,
          updatedAt: new Date().toISOString(),
        },
      }),
    );

    return json(200, { ok: true });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") {
      return unauthorized("Sessão expirada. Faça login novamente.");
    }
    return serverError("Não foi possível selecionar workspace agora.");
  }
};

