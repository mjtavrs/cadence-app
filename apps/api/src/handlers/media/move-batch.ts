import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";
import { MEDIA } from "../../media/limits";

type MoveBatchBody = {
  workspaceId?: string;
  mediaIds?: string[];
  folderId?: string | null;
};

type MediaRow = {
  PK: string;
  SK: string;
  mediaId: string;
};

const MAX_ITEMS_PER_BATCH = 25;

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  let body: MoveBatchBody = {};
  try {
    body = event.body ? (JSON.parse(event.body) as MoveBatchBody) : {};
  } catch {
    return badRequest("Body invalido (JSON).");
  }

  const workspaceId = body.workspaceId?.trim();
  const mediaIds = body.mediaIds ?? [];
  const folderId = typeof body.folderId === "string" ? body.folderId.trim() : null;

  if (!workspaceId) return badRequest("workspaceId e obrigatorio.");
  if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
    return badRequest("mediaIds deve ser um array nao vazio.");
  }
  if (mediaIds.length > MAX_ITEMS_PER_BATCH) {
    return badRequest(`Maximo de ${MAX_ITEMS_PER_BATCH} itens por batch.`);
  }

  const uniqueIds = [...new Set(mediaIds.map((id) => id?.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return badRequest("Nenhum mediaId valido.");

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

    const mediaRes = await ddb.send(
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

    const rows = (mediaRes.Items ?? []) as MediaRow[];
    const byId = new Map(rows.map((row) => [row.mediaId, row] as const));

    const toMove: MediaRow[] = [];
    const errors: Array<{ mediaId: string; message: string }> = [];
    for (const id of uniqueIds) {
      const row = byId.get(id);
      if (!row) {
        errors.push({ mediaId: id, message: "Midia nao encontrada." });
        continue;
      }
      toMove.push(row);
    }

    if (toMove.length === 0) {
      return json(400, { message: "Nenhuma midia encontrada para mover.", errors });
    }

    await Promise.all(
      toMove.map((row) =>
        ddb.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { PK: row.PK, SK: row.SK },
            UpdateExpression: "SET folderId = :folderId",
            ExpressionAttributeValues: {
              ":folderId": folderId ?? null,
            },
          }),
        ),
      ),
    );

    const moved = toMove.map((row) => row.mediaId);
    return json(200, {
      moved,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAuthorizedException") return unauthorized("Sessao expirada. Faca login novamente.");
    return serverError("Nao foi possivel mover as midias agora.");
  }
};

