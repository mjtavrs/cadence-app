import type { APIGatewayProxyHandler } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { MEDIA } from "../../media/limits";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type MediaSummaryItem = {
  sizeBytes?: number;
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  const workspaceId = event.queryStringParameters?.workspaceId?.trim();
  if (!workspaceId) return badRequest("workspaceId é obrigatório.");

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");

    const ddb = getDocClient();
    const tableName = getTableName();

    let itemsUsed = 0;
    let bytesUsed = 0;
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const res = await ddb.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
          ExpressionAttributeValues: {
            ":pk": `WORKSPACE#${workspaceId}`,
            ":skPrefix": "MEDIA#",
          },
          ProjectionExpression: "sizeBytes",
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      for (const item of (res.Items ?? []) as MediaSummaryItem[]) {
        itemsUsed += 1;
        bytesUsed += typeof item.sizeBytes === "number" ? item.sizeBytes : 0;
      }

      lastEvaluatedKey = res.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return json(200, {
      itemsUsed,
      itemsLimit: MEDIA.maxItemsPerWorkspace,
      bytesUsed,
      bytesLimit: MEDIA.maxBytesPerWorkspace,
    });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível carregar o resumo de armazenamento agora.");
  }
};
