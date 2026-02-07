import type { APIGatewayProxyHandler } from "aws-lambda";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { canWrite } from "../../auth/rbac";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { newPostId, newPostShortCode } from "../../posts/ids";
import { normalizeTags, normalizeTitle, validateTags, validateTitle } from "../../posts/metadata";
import { isValidSingleMedia, normalizeCaption } from "../../posts/schedule";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type Body = {
  workspaceId?: string;
  title?: string;
  caption?: string;
  mediaIds?: string[];
  tags?: string[] | string;
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
  const title = normalizeTitle(body.title);
  const caption = normalizeCaption(body.caption ?? "");
  const mediaIds = body.mediaIds ?? [];
  const tags = normalizeTags(body.tags);

  if (!workspaceId) return badRequest("workspaceId é obrigatório.");
  if (!title) return badRequest("Título é obrigatório.");
  if (!caption) return badRequest("Legenda não pode estar vazia.");
  if (!isValidSingleMedia(mediaIds)) return badRequest("No MVP, o post deve conter exatamente 1 mídia.");

  const titleErr = validateTitle(title);
  if (titleErr) return badRequest(titleErr);
  const tagsErr = validateTags(tags);
  if (tagsErr) return badRequest(tagsErr);

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

    const pk = `WORKSPACE#${workspaceId}`;

    for (let attempt = 0; attempt < 8; attempt++) {
      const shortCode = newPostShortCode(6);
      try {
        await ddb.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: tableName,
                  Item: {
                    PK: pk,
                    SK: `POST#${postId}`,
                    postId,
                    workspaceId,
                    title,
                    shortCode,
                    tags,
                    status: "DRAFT",
                    caption,
                    mediaIds,
                    createdAt: now,
                    createdByUserId: userId,
                    createdByRole: membership.role,
                    updatedAt: now,
                  },
                  ConditionExpression: "attribute_not_exists(PK)",
                },
              },
              {
                Put: {
                  TableName: tableName,
                  Item: {
                    PK: pk,
                    SK: `POSTCODE#${shortCode}`,
                    workspaceId,
                    postId,
                    shortCode,
                    createdAt: now,
                  },
                  ConditionExpression: "attribute_not_exists(PK)",
                },
              },
            ],
          }),
        );

        return json(201, { id: postId, shortCode });
      } catch (err: any) {
        const name = err?.name as string | undefined;
        if (name === "TransactionCanceledException") {
          if (attempt < 7) continue;
          return serverError("Não foi possível gerar um código único para o post agora.");
        }
        throw err;
      }
    }

    return serverError("Não foi possível criar o post agora.");
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível criar o post agora.");
  }
};

