import type { APIGatewayProxyHandler } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { MEDIA } from "../../media/limits";
import { signPutObject } from "../../media/s3";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type PresignBody = {
  workspaceId?: string;
  contentType?: string;
  fileName?: string;
  sizeBytes?: number;
};

function safeExtFromContentType(contentType: string) {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  return map[contentType] ?? "bin";
}

function randomId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  let body: PresignBody = {};
  try {
    body = event.body ? (JSON.parse(event.body) as PresignBody) : {};
  } catch {
    return badRequest("Body inválido (JSON).");
  }

  const workspaceId = body.workspaceId?.trim();
  const contentType = body.contentType?.trim();
  const sizeBytes = body.sizeBytes;

  if (!workspaceId) return badRequest("workspaceId é obrigatório.");
  if (!contentType || !MEDIA.allowedContentTypes.has(contentType)) {
    return badRequest("Formato de imagem não suportado.");
  }
  if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return badRequest("sizeBytes inválido.");
  }
  if (sizeBytes > MEDIA.maxBytes) return badRequest("Arquivo excede 10MB.");

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");

    const ddb = getDocClient();
    const tableName = getTableName();

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
      return badRequest(
        `Limite de armazenamento atingido. Restam ${availableMb.toFixed(1)}MB disponíveis no workspace.`,
      );
    }

    const id = randomId();
    const ext = safeExtFromContentType(contentType);
    const key = `workspaces/${workspaceId}/media/${id}.${ext}`;

    const uploadUrl = await signPutObject({
      key,
      contentType,
      contentLength: sizeBytes,
      expiresSeconds: 60,
    });

    return json(200, { mediaId: id, s3Key: key, uploadUrl });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível preparar o upload agora.");
  }
};

