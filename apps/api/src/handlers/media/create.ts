import type { APIGatewayProxyHandler } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { MEDIA } from "../../media/limits";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type CreateBody = {
  workspaceId?: string;
  mediaId?: string;
  s3Key?: string;
  contentType?: string;
  sizeBytes?: number;
  fileName?: string;
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  let body: CreateBody = {};
  try {
    body = event.body ? (JSON.parse(event.body) as CreateBody) : {};
  } catch {
    return badRequest("Body inválido (JSON).");
  }

  const workspaceId = body.workspaceId?.trim();
  const mediaId = body.mediaId?.trim();
  const s3Key = body.s3Key?.trim();
  const contentType = body.contentType?.trim();
  const sizeBytes = body.sizeBytes;
  const fileName = body.fileName?.trim() || null;

  if (!workspaceId) return badRequest("workspaceId é obrigatório.");
  if (!mediaId) return badRequest("mediaId é obrigatório.");
  if (!s3Key) return badRequest("s3Key é obrigatório.");
  if (!contentType || !MEDIA.allowedContentTypes.has(contentType)) return badRequest("contentType inválido.");
  if (typeof sizeBytes !== "number" || sizeBytes <= 0 || sizeBytes > MEDIA.maxBytes) return badRequest("sizeBytes inválido.");

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");

    const ddb = getDocClient();
    const tableName = getTableName();

    const createdAt = new Date().toISOString();

    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: `WORKSPACE#${workspaceId}`,
          SK: `MEDIA#${createdAt}#${mediaId}`,
          mediaId,
          workspaceId,
          contentType,
          sizeBytes,
          fileName,
          s3Key,
          createdAt,
        },
      }),
    );

    return json(201, { ok: true, mediaId });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível registrar a mídia agora.");
  }
};

