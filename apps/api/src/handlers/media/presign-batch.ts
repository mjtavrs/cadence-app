import type { APIGatewayProxyHandler } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { MEDIA } from "../../media/limits";
import { signPutObject } from "../../media/s3";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type FileInput = {
  contentType?: string;
  fileName?: string;
  sizeBytes?: number;
};

type PresignBatchBody = {
  workspaceId?: string;
  files?: FileInput[];
};

const MAX_FILES_PER_BATCH = 25;

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

  let body: PresignBatchBody = {};
  try {
    body = event.body ? (JSON.parse(event.body) as PresignBatchBody) : {};
  } catch {
    return badRequest("Body inválido (JSON).");
  }

  const workspaceId = body.workspaceId?.trim();
  const files = body.files ?? [];

  if (!workspaceId) return badRequest("workspaceId é obrigatório.");
  if (!Array.isArray(files) || files.length === 0) {
    return badRequest("files deve ser um array não vazio.");
  }
  if (files.length > MAX_FILES_PER_BATCH) {
    return badRequest(`Máximo de ${MAX_FILES_PER_BATCH} arquivos por batch.`);
  }

  const errors: Array<{ index: number; message: string }> = [];
  const validFiles: Array<{ index: number; file: FileInput }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const contentType = file?.contentType?.trim();
    const sizeBytes = file?.sizeBytes;

    if (!contentType || !MEDIA.allowedContentTypes.has(contentType)) {
      errors.push({ index: i, message: "Formato de imagem não suportado." });
      continue;
    }
    if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      errors.push({ index: i, message: "sizeBytes inválido." });
      continue;
    }
    if (sizeBytes > MEDIA.maxBytes) {
      errors.push({ index: i, message: "Arquivo excede 10MB." });
      continue;
    }

    validFiles.push({ index: i, file });
  }

  if (validFiles.length === 0) {
    return json(400, { message: "Nenhum arquivo válido encontrado.", errors });
  }

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
    const totalAfterBatch = existingCount + validFiles.length;
    const incomingBytes = validFiles.reduce((sum, file) => sum + (file.file.sizeBytes ?? 0), 0);

    if (totalAfterBatch > MEDIA.maxItemsPerWorkspace) {
      const available = MEDIA.maxItemsPerWorkspace - existingCount;
      return json(400, {
        message: `Limite de ${MEDIA.maxItemsPerWorkspace} imagens atingido. Você pode fazer upload de ${available} arquivo(s).`,
      });
    }
    if (existingBytes + incomingBytes > MEDIA.maxBytesPerWorkspace) {
      const availableMb = Math.max(0, (MEDIA.maxBytesPerWorkspace - existingBytes) / (1024 * 1024));
      return json(400, {
        message: `Limite de armazenamento atingido. Restam ${availableMb.toFixed(1)}MB disponíveis no workspace.`,
      });
    }

    const presigns = await Promise.all(
      validFiles.map(async ({ index, file }) => {
        const contentType = file.contentType!.trim();
        const sizeBytes = file.sizeBytes!;
        const id = randomId();
        const ext = safeExtFromContentType(contentType);
        const key = `workspaces/${workspaceId}/media/${id}.${ext}`;

        const uploadUrl = await signPutObject({
          key,
          contentType,
          contentLength: sizeBytes,
          expiresSeconds: 60,
        });

        return {
          index,
          mediaId: id,
          s3Key: key,
          uploadUrl,
        };
      }),
    );

    const response: {
      presigns: Array<{
        index: number;
        mediaId: string;
        s3Key: string;
        uploadUrl: string;
      }>;
      errors?: Array<{ index: number; message: string }>;
    } = { presigns };

    if (errors.length > 0) {
      response.errors = errors;
    }

    return json(200, response);
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível preparar o upload agora.");
  }
};
