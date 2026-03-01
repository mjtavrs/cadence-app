import type { APIGatewayProxyHandler } from "aws-lambda";
import { UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { canManageApproval, canWrite } from "../../auth/rbac";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { normalizeTags, normalizeTitle, validateTags, validateTitle } from "../../posts/metadata";
import { isValidSingleMedia, normalizeCaption } from "../../posts/schedule";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type Body = {
  workspaceId?: string;
  title?: string;
  caption?: string;
  mediaIds?: string[];
  tags?: string[] | string;
  aspectRatio?: string;
  cropX?: number;
  cropY?: number;
};

type Post = {
  PK: string;
  SK: string;
  status: string;
};

const VALID_ASPECT_RATIOS = new Set(["original", "1:1", "4:5", "16:9"]);

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  const postId = event.pathParameters?.id?.trim();
  if (!postId) return badRequest("id é obrigatório.");

  let body: Body = {};
  try {
    body = event.body ? (JSON.parse(event.body) as Body) : {};
  } catch {
    return badRequest("Body inválido (JSON).");
  }

  const workspaceId = body.workspaceId?.trim();
  const title = body.title != null ? normalizeTitle(body.title) : null;
  const caption = normalizeCaption(body.caption ?? "");
  const mediaIds = body.mediaIds ?? [];
  const tags = body.tags != null ? normalizeTags(body.tags) : null;

  const rawAspectRatio = body.aspectRatio?.trim();
  const aspectRatio = rawAspectRatio == null || rawAspectRatio.length === 0
    ? null
    : rawAspectRatio;
  if (aspectRatio && !VALID_ASPECT_RATIOS.has(aspectRatio)) {
    return badRequest("aspectRatio inválido.");
  }

  const hasCropX = body.cropX != null;
  const hasCropY = body.cropY != null;
  const cropX = typeof body.cropX === "number" && Number.isFinite(body.cropX) ? body.cropX : null;
  const cropY = typeof body.cropY === "number" && Number.isFinite(body.cropY) ? body.cropY : null;

  if (hasCropX && (cropX == null || cropX < 0 || cropX > 1)) {
    return badRequest("cropX inválido.");
  }
  if (hasCropY && (cropY == null || cropY < 0 || cropY > 1)) {
    return badRequest("cropY inválido.");
  }

  if (!workspaceId) return badRequest("workspaceId é obrigatório.");
  if (!caption) return badRequest("Legenda não pode estar vazia.");
  if (!isValidSingleMedia(mediaIds)) return badRequest("No MVP, o post deve conter exatamente 1 mídia.");
  if (title != null) {
    if (!title) return badRequest("Título não pode estar vazio.");
    const titleErr = validateTitle(title);
    if (titleErr) return badRequest(titleErr);
  }
  if (tags != null) {
    const tagsErr = validateTags(tags);
    if (tagsErr) return badRequest(tagsErr);
  }

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");
    if (!canWrite(membership.role)) return unauthorized("Sem permissão para editar posts.");

    const ddb = getDocClient();
    const tableName = getTableName();
    const key = { PK: `WORKSPACE#${workspaceId}`, SK: `POST#${postId}` };

    const existing = await ddb.send(new GetCommand({ TableName: tableName, Key: key }));
    const post = existing.Item as Post | undefined;
    if (!post) return badRequest("Post não encontrado.");

    const now = new Date().toISOString();
    const shouldReReview =
      !canManageApproval(membership.role) &&
      (post.status === "APPROVED" || post.status === "SCHEDULED");

    const setParts: string[] = ["#caption = :caption", "#mediaIds = :mediaIds", "#updatedAt = :now"];
    const removeParts: string[] = [];

    const names: Record<string, string> = {
      "#caption": "caption",
      "#mediaIds": "mediaIds",
      "#updatedAt": "updatedAt",
    };
    const values: Record<string, unknown> = {
      ":caption": caption,
      ":mediaIds": mediaIds,
      ":now": now,
    };

    if (title != null) {
      setParts.push("#title = :title");
      names["#title"] = "title";
      values[":title"] = title;
    }

    if (tags != null) {
      setParts.push("#tags = :tags");
      names["#tags"] = "tags";
      values[":tags"] = tags;
    }

    if (aspectRatio != null) {
      setParts.push("#aspectRatio = :aspectRatio");
      names["#aspectRatio"] = "aspectRatio";
      values[":aspectRatio"] = aspectRatio;
    }

    if (hasCropX) {
      setParts.push("#cropX = :cropX");
      names["#cropX"] = "cropX";
      values[":cropX"] = cropX;
    }

    if (hasCropY) {
      setParts.push("#cropY = :cropY");
      names["#cropY"] = "cropY";
      values[":cropY"] = cropY;
    }

    if (shouldReReview) {
      setParts.push("#status = :status");
      names["#status"] = "status";
      values[":status"] = "IN_REVIEW";

      removeParts.push(
        "scheduledAtUtc",
        "weekBucket",
        "monthBucket",
        "GSI2PK",
        "GSI2SK",
        "GSI3PK",
        "GSI3SK",
        "GSI4PK",
        "GSI4SK",
      );
    }

    const expr = `SET ${setParts.join(", ")}${removeParts.length ? ` REMOVE ${removeParts.join(", ")}` : ""}`;

    await ddb.send(
      new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression: expr,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }),
    );

    return json(200, { ok: true });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível atualizar o post agora.");
  }
};
