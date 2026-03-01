import type { APIGatewayProxyHandler } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { canManageApproval } from "../../auth/rbac";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { computeMonthBucketRecife, computeWeekBucketRecife } from "../../posts/schedule";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

function nowPlusTwoMinutesIso() {
  const d = new Date(Date.now() + 2 * 60 * 1000);
  d.setUTCSeconds(0, 0);
  return d.toISOString();
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
    if (!canManageApproval(membership.role)) return unauthorized("Sem permissão para reagendar posts.");

    const ddb = getDocClient();
    const tableName = getTableName();
    const now = new Date().toISOString();
    const scheduledAtUtc = nowPlusTwoMinutesIso();
    const weekBucket = computeWeekBucketRecife(scheduledAtUtc);
    const monthBucket = computeMonthBucketRecife(scheduledAtUtc);

    await ddb.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: `WORKSPACE#${workspaceId}`, SK: `POST#${postId}` },
        ConditionExpression: "#status = :failed",
        UpdateExpression:
          "SET #status = :scheduled, #scheduledAtUtc = :scheduledAtUtc, #weekBucket = :weekBucket, #monthBucket = :monthBucket, #gsi2pk = :gsi2pk, #gsi2sk = :gsi2sk, #gsi3pk = :gsi3pk, #gsi3sk = :gsi3sk, #gsi4pk = :gsi4pk, #gsi4sk = :gsi4sk, #updatedAt = :now REMOVE #errorMessage",
        ExpressionAttributeNames: {
          "#status": "status",
          "#scheduledAtUtc": "scheduledAtUtc",
          "#weekBucket": "weekBucket",
          "#monthBucket": "monthBucket",
          "#gsi2pk": "GSI2PK",
          "#gsi2sk": "GSI2SK",
          "#gsi3pk": "GSI3PK",
          "#gsi3sk": "GSI3SK",
          "#gsi4pk": "GSI4PK",
          "#gsi4sk": "GSI4SK",
          "#updatedAt": "updatedAt",
          "#errorMessage": "errorMessage",
        },
        ExpressionAttributeValues: {
          ":failed": "FAILED",
          ":scheduled": "SCHEDULED",
          ":scheduledAtUtc": scheduledAtUtc,
          ":weekBucket": weekBucket,
          ":monthBucket": monthBucket,
          ":gsi2pk": `WORKSPACE#${workspaceId}#WEEK#${weekBucket}`,
          ":gsi2sk": `${scheduledAtUtc}#POST#${postId}`,
          ":gsi3pk": "DISPATCH",
          ":gsi3sk": `${scheduledAtUtc}#WORKSPACE#${workspaceId}#POST#${postId}`,
          ":gsi4pk": `WORKSPACE#${workspaceId}#MONTH#${monthBucket}`,
          ":gsi4sk": `${scheduledAtUtc}#POST#${postId}`,
          ":now": now,
        },
      }),
    );

    return json(200, { ok: true, scheduledAtUtc });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "ConditionalCheckFailedException") {
      return badRequest("Post não está em FAILED.");
    }
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível reagendar o post agora.");
  }
};
