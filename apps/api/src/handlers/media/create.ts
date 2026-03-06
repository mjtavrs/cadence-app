import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";
import { MEDIA } from "../../media/limits";

type CreateBody = {
  workspaceId?: string;
  mediaId?: string;
  s3Key?: string;
  contentType?: string;
  sizeBytes?: number;
  fileName?: string;
  folderId?: string | null;
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  let body: CreateBody = {};
  try {
    body = event.body ? (JSON.parse(event.body) as CreateBody) : {};
  } catch {
    return badRequest("Body invalido (JSON).");
  }

  const workspaceId = body.workspaceId?.trim();
  const mediaId = body.mediaId?.trim();
  const s3Key = body.s3Key?.trim();
  const contentType = body.contentType?.trim();
  const sizeBytes = body.sizeBytes;
  const fileName = body.fileName?.trim() || null;
  const folderId = typeof body.folderId === "string" ? body.folderId.trim() : null;

  if (!workspaceId) return badRequest("workspaceId e obrigatorio.");
  if (!mediaId) return badRequest("mediaId e obrigatorio.");
  if (!s3Key) return badRequest("s3Key e obrigatorio.");
  if (!contentType || !MEDIA.allowedContentTypes.has(contentType)) return badRequest("contentType invalido.");
  if (typeof sizeBytes !== "number" || sizeBytes <= 0 || sizeBytes > MEDIA.maxBytes) return badRequest("sizeBytes invalido.");

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");

    const ddb = getDocClient();
    const tableName = getTableName();

    if (folderId) {
      const folderRes = await ddb.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            PK: `WORKSPACE#${workspaceId}`,
            SK: `FOLDER#${folderId}`,
          },
          ProjectionExpression: "folderId",
        }),
      );

      if (!folderRes.Item) return badRequest("Pasta nao encontrada.");
    }

    const existing = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `WORKSPACE#${workspaceId}`,
          ":skPrefix": "MEDIA#",
        },
        ProjectionExpression: "sizeBytes",
        Limit: MEDIA.maxItemsPerWorkspace,
      }),
    );

    const existingItems = existing.Items ?? [];
    const existingCount = existingItems.length;
    const existingBytes = existingItems.reduce((sum, item) => {
      const size = (item as { sizeBytes?: unknown }).sizeBytes;
      return sum + (typeof size === "number" ? size : 0);
    }, 0);

    if (existingCount >= MEDIA.maxItemsPerWorkspace) {
      return badRequest(`Limite de ${MEDIA.maxItemsPerWorkspace} imagens atingido para este workspace.`);
    }
    if (existingBytes + sizeBytes > MEDIA.maxBytesPerWorkspace) {
      const availableMb = Math.max(0, (MEDIA.maxBytesPerWorkspace - existingBytes) / (1024 * 1024));
      return badRequest(`Limite de armazenamento atingido. Restam ${availableMb.toFixed(1)}MB disponiveis no workspace.`);
    }

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
          folderId,
          s3Key,
          createdAt,
        },
      }),
    );

    return json(201, { ok: true, mediaId });
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAuthorizedException") return unauthorized("Sessao expirada. Faca login novamente.");
    return serverError("Nao foi possivel registrar a midia agora.");
  }
};
