import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { canManageApproval, canWrite } from "../../auth/rbac";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";
import { newPostId, newPostShortCode } from "../../posts/ids";
import {
  computeMonthBucketRecife,
  computeWeekBucketRecife,
  isAlignedToMinutes,
  parseUtcIso,
} from "../../posts/schedule";

type Body = {
  scheduledAtUtc?: string;
};

type PostRecord = {
  postId: string;
  title?: string;
  caption?: string;
  tags?: string[];
  mediaIds?: string[];
  aspectRatio?: "original" | "1:1" | "4:5" | "16:9";
  cropX?: number;
  cropY?: number;
};

const VALID_ASPECTS = new Set(["original", "1:1", "4:5", "16:9"]);

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  const sourcePostId = event.pathParameters?.id?.trim();
  const workspaceId = event.queryStringParameters?.workspaceId?.trim();
  if (!workspaceId) return badRequest("workspaceId é obrigatório.");
  if (!sourcePostId) return badRequest("id é obrigatório.");

  let body: Body = {};
  try {
    body = event.body ? (JSON.parse(event.body) as Body) : {};
  } catch {
    return badRequest("Body inválido (JSON).");
  }

  const rawScheduled = body.scheduledAtUtc?.trim();
  let scheduledAtUtc: string | null = null;
  let weekBucket: string | null = null;
  let monthBucket: string | null = null;
  if (rawScheduled) {
    scheduledAtUtc = parseUtcIso(rawScheduled);
    if (!scheduledAtUtc) return badRequest("scheduledAtUtc inválido.");
    if (!isAlignedToMinutes(scheduledAtUtc, 15)) return badRequest("Agendamento deve ser de 15 em 15 minutos.");
    if (scheduledAtUtc <= new Date().toISOString()) return badRequest("Agendamento deve ser no futuro.");
    weekBucket = computeWeekBucketRecife(scheduledAtUtc);
    monthBucket = computeMonthBucketRecife(scheduledAtUtc);
  }

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");
    if (!canWrite(membership.role)) return unauthorized("Sem permissão para duplicar posts.");

    const ddb = getDocClient();
    const tableName = getTableName();
    const sourceKey = { PK: `WORKSPACE#${workspaceId}`, SK: `POST#${sourcePostId}` };
    const sourceRes = await ddb.send(new GetCommand({ TableName: tableName, Key: sourceKey }));
    const source = sourceRes.Item as PostRecord | undefined;
    if (!source) return badRequest("Post não encontrado.");

    const sourceMediaIds = Array.isArray(source.mediaIds) ? source.mediaIds : [];
    if (sourceMediaIds.length !== 1) {
      return badRequest("No MVP, o post de origem precisa conter exatamente 1 mídia.");
    }

    const postId = newPostId();
    const now = new Date().toISOString();
    const pk = `WORKSPACE#${workspaceId}`;

    const status = scheduledAtUtc
      ? canManageApproval(membership.role)
        ? "SCHEDULED"
        : "IN_REVIEW"
      : "DRAFT";

    const rawAspect = source.aspectRatio;
    const aspectRatio =
      typeof rawAspect === "string" && VALID_ASPECTS.has(rawAspect) ? rawAspect : "1:1";
    const cropX =
      typeof source.cropX === "number" && source.cropX >= 0 && source.cropX <= 1 ? source.cropX : 0.5;
    const cropY =
      typeof source.cropY === "number" && source.cropY >= 0 && source.cropY <= 1 ? source.cropY : 0.5;

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
                    title: source.title ?? "",
                    shortCode,
                    tags: Array.isArray(source.tags) ? source.tags : [],
                    status,
                    caption: source.caption ?? "",
                    mediaIds: sourceMediaIds,
                    aspectRatio,
                    cropX,
                    cropY,
                    createdAt: now,
                    createdByUserId: userId,
                    createdByRole: membership.role,
                    updatedAt: now,
                    ...(scheduledAtUtc && weekBucket && monthBucket
                      ? {
                          scheduledAtUtc,
                          weekBucket,
                          monthBucket,
                          GSI2PK: `WORKSPACE#${workspaceId}#WEEK#${weekBucket}`,
                          GSI2SK: `${scheduledAtUtc}#POST#${postId}`,
                          GSI4PK: `WORKSPACE#${workspaceId}#MONTH#${monthBucket}`,
                          GSI4SK: `${scheduledAtUtc}#POST#${postId}`,
                          ...(status === "SCHEDULED"
                            ? {
                                GSI3PK: "DISPATCH",
                                GSI3SK: `${scheduledAtUtc}#WORKSPACE#${workspaceId}#POST#${postId}`,
                              }
                            : {}),
                        }
                      : {}),
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

        return json(201, { postId, shortCode, status, scheduledAtUtc });
      } catch (err: any) {
        if (err?.name === "TransactionCanceledException") {
          if (attempt < 7) continue;
          return serverError("Não foi possível gerar um código único para o post agora.");
        }
        throw err;
      }
    }

    return serverError("Não foi possível duplicar o post agora.");
  } catch (err: any) {
    if (err?.name === "NotAuthorizedException") {
      return unauthorized("Sessão expirada. Faça login novamente.");
    }
    return serverError("Não foi possível duplicar o post agora.");
  }
};
