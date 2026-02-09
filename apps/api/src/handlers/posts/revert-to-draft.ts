import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { canWrite } from "../../auth/rbac";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

const ALLOWED_STATUSES = ["IN_REVIEW", "APPROVED", "SCHEDULED"] as const;

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
    if (!canWrite(membership.role)) return unauthorized("Sem permissão para mover post para rascunho.");

    const ddb = getDocClient();
    const tableName = getTableName();
    const key = { PK: `WORKSPACE#${workspaceId}`, SK: `POST#${postId}` };

    const getRes = await ddb.send(new GetCommand({ TableName: tableName, Key: key }));
    const post = getRes.Item as { status?: string } | undefined;
    if (!post) return badRequest("Post não encontrado.");

    const status = post.status ?? "";
    if (!ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
      return badRequest("Só é possível mover para rascunho posts em revisão, aprovados ou agendados.");
    }

    const now = new Date().toISOString();

    if (status === "SCHEDULED") {
      await ddb.send(
        new UpdateCommand({
          TableName: tableName,
          Key: key,
          ConditionExpression: "#status = :scheduled",
          UpdateExpression:
            "SET #status = :draft, #updatedAt = :now REMOVE scheduledAtUtc, weekBucket, monthBucket, GSI2PK, GSI2SK, GSI3PK, GSI3SK, GSI4PK, GSI4SK",
          ExpressionAttributeNames: { "#status": "status", "#updatedAt": "updatedAt" },
          ExpressionAttributeValues: { ":scheduled": "SCHEDULED", ":draft": "DRAFT", ":now": now },
        }),
      );
    } else {
      await ddb.send(
        new UpdateCommand({
          TableName: tableName,
          Key: key,
          ConditionExpression: "#status = :review OR #status = :approved",
          UpdateExpression: "SET #status = :draft, #updatedAt = :now",
          ExpressionAttributeNames: { "#status": "status", "#updatedAt": "updatedAt" },
          ExpressionAttributeValues: {
            ":review": "IN_REVIEW",
            ":approved": "APPROVED",
            ":draft": "DRAFT",
            ":now": now,
          },
        }),
      );
    }

    return json(200, { ok: true });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "ConditionalCheckFailedException") {
      return badRequest("Post não pode ser movido para rascunho neste estado.");
    }
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível mover o post para rascunho agora.");
  }
};
