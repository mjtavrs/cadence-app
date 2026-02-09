import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { canWrite } from "../../auth/rbac";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { computeMonthBucketRecife, computeWeekBucketRecife } from "../../posts/schedule";
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
    const key = { PK: `WORKSPACE#${workspaceId}`, SK: `POST#${postId}` };

    const getRes = await ddb.send(new GetCommand({ TableName: tableName, Key: key }));
    const post = getRes.Item as { status?: string; scheduledAtUtc?: string } | undefined;
    if (!post) return badRequest("Post não encontrado.");
    if (post.status !== "IN_REVIEW") return badRequest("Post não está em IN_REVIEW.");

    const now = new Date().toISOString();
    const scheduledAtUtc = typeof post.scheduledAtUtc === "string" ? post.scheduledAtUtc : null;
    const goScheduled = scheduledAtUtc && scheduledAtUtc > now;

    if (goScheduled) {
      const weekBucket = computeWeekBucketRecife(scheduledAtUtc);
      const monthBucket = computeMonthBucketRecife(scheduledAtUtc);
      await ddb.send(
        new UpdateCommand({
          TableName: tableName,
          Key: key,
          ConditionExpression: "#status = :review",
          UpdateExpression:
            "SET #status = :scheduled, #updatedAt = :now, #weekBucket = :weekBucket, #monthBucket = :monthBucket, #gsi2pk = :gsi2pk, #gsi2sk = :gsi2sk, #gsi3pk = :gsi3pk, #gsi3sk = :gsi3sk, #gsi4pk = :gsi4pk, #gsi4sk = :gsi4sk",
          ExpressionAttributeNames: {
            "#status": "status",
            "#updatedAt": "updatedAt",
            "#weekBucket": "weekBucket",
            "#monthBucket": "monthBucket",
            "#gsi2pk": "GSI2PK",
            "#gsi2sk": "GSI2SK",
            "#gsi3pk": "GSI3PK",
            "#gsi3sk": "GSI3SK",
            "#gsi4pk": "GSI4PK",
            "#gsi4sk": "GSI4SK",
          },
          ExpressionAttributeValues: {
            ":review": "IN_REVIEW",
            ":scheduled": "SCHEDULED",
            ":now": now,
            ":weekBucket": weekBucket,
            ":monthBucket": monthBucket,
            ":gsi2pk": `WORKSPACE#${workspaceId}#WEEK#${weekBucket}`,
            ":gsi2sk": `${scheduledAtUtc}#POST#${postId}`,
            ":gsi3pk": "DISPATCH",
            ":gsi3sk": `${scheduledAtUtc}#WORKSPACE#${workspaceId}#POST#${postId}`,
            ":gsi4pk": `WORKSPACE#${workspaceId}#MONTH#${monthBucket}`,
            ":gsi4sk": `${scheduledAtUtc}#POST#${postId}`,
          },
        }),
      );
    } else {
      await ddb.send(
        new UpdateCommand({
          TableName: tableName,
          Key: key,
          ConditionExpression: "#status = :review",
          UpdateExpression: "SET #status = :approved, #updatedAt = :now",
          ExpressionAttributeNames: { "#status": "status", "#updatedAt": "updatedAt" },
          ExpressionAttributeValues: { ":review": "IN_REVIEW", ":approved": "APPROVED", ":now": now },
        }),
      );
    }

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

