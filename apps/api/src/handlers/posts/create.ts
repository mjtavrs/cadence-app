import type { APIGatewayProxyHandler } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { canWrite } from "../../auth/rbac";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { newPostId } from "../../posts/ids";
import { isValidSingleMedia, normalizeCaption } from "../../posts/schedule";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type Body = {
  workspaceId?: string;
  caption?: string;
  mediaIds?: string[];
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

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
    if (!canWrite(membership.role)) return unauthorized("Sem permissão para criar posts.");

    const ddb = getDocClient();
    const tableName = getTableName();

    const postId = newPostId();
    const now = new Date().toISOString();

    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: `WORKSPACE#${workspaceId}`,
          SK: `POST#${postId}`,
          postId,
          workspaceId,
          status: "DRAFT",
          caption,
          mediaIds,
          createdAt: now,
          createdByUserId: userId,
          createdByRole: membership.role,
          updatedAt: now,
        },
      }),
    );

    return json(201, { id: postId });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível criar o post agora.");
  }
};

