import type { APIGatewayProxyHandler } from "aws-lambda";
import { UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { canWrite } from "../../auth/rbac";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { isValidSingleMedia, normalizeCaption } from "../../posts/schedule";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type Body = {
  workspaceId?: string;
  caption?: string;
  mediaIds?: string[];
};

type Post = {
  PK: string;
  SK: string;
  status: string;
};

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
  const caption = normalizeCaption(body.caption ?? "");
  const mediaIds = body.mediaIds ?? [];

  if (!workspaceId) return badRequest("workspaceId é obrigatório.");
  if (!caption) return badRequest("Legenda não pode estar vazia.");
  if (!isValidSingleMedia(mediaIds)) return badRequest("No MVP, o post deve conter exatamente 1 mídia.");

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

    const shouldReReview = post.status === "APPROVED" || post.status === "SCHEDULED";

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

    if (shouldReReview) {
      setParts.push("#status = :status");
      names["#status"] = "status";
      values[":status"] = "IN_REVIEW";

      removeParts.push("scheduledAtUtc", "weekBucket", "GSI2PK", "GSI2SK", "GSI3PK", "GSI3SK");
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

