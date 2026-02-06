import type { APIGatewayProxyHandler } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { canWrite } from "../../auth/rbac";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

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
    if (!canWrite(membership.role)) return unauthorized("Sem permissão para aprovar posts.");

    const ddb = getDocClient();
    const tableName = getTableName();
    const now = new Date().toISOString();

    await ddb.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: `WORKSPACE#${workspaceId}`, SK: `POST#${postId}` },
        ConditionExpression: "#status = :review",
        UpdateExpression: "SET #status = :approved, #updatedAt = :now",
        ExpressionAttributeNames: { "#status": "status", "#updatedAt": "updatedAt" },
        ExpressionAttributeValues: { ":review": "IN_REVIEW", ":approved": "APPROVED", ":now": now },
      }),
    );

    return json(200, { ok: true });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "ConditionalCheckFailedException") {
      return badRequest("Post não está em IN_REVIEW.");
    }
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível aprovar o post agora.");
  }
};

