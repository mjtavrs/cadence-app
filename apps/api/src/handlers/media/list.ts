import type { APIGatewayProxyHandler } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { MEDIA } from "../../media/limits";
import { signGetObject } from "../../media/s3";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type MediaItem = {
  PK: string;
  SK: string;
  mediaId: string;
  contentType: string;
  sizeBytes: number;
  fileName?: string | null;
  s3Key: string;
  createdAt: string;
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

    const res = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `WORKSPACE#${workspaceId}`,
          ":skPrefix": "MEDIA#",
        },
        ScanIndexForward: false,
        Limit: MEDIA.maxItemsPerWorkspace,
      }),
    );

    const items = (res.Items ?? []) as MediaItem[];
    const withUrls = await Promise.all(
      items.map(async (m) => ({
        id: m.mediaId,
        contentType: m.contentType,
        sizeBytes: m.sizeBytes,
        fileName: m.fileName ?? null,
        createdAt: m.createdAt,
        url: await signGetObject({ key: m.s3Key, expiresSeconds: 60 * 10 }),
      })),
    );

    return json(200, { items: withUrls });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível listar mídias agora.");
  }
};

