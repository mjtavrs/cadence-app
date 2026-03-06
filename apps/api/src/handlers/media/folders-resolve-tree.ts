import type { APIGatewayProxyHandler } from "aws-lambda";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";
import { MAX_FOLDER_NAME_LENGTH, normalizeFolderName, splitPathSegments } from "../../media/names";

type Body = {
  workspaceId?: string;
  parentFolderId?: string | null;
  folders?: string[];
};

type FolderRow = {
  folderId?: string;
  name?: string | null;
  parentFolderId?: string | null;
};

function newFolderId() {
  return `fld_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function folderKey(parentFolderId: string | null, name: string) {
  return `${parentFolderId ?? "ROOT"}::${normalizeFolderName(name)}`;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  let body: Body = {};
  try {
    body = event.body ? (JSON.parse(event.body) as Body) : {};
  } catch {
    return badRequest("Body invalido (JSON).");
  }

  const workspaceId = body.workspaceId?.trim();
  const parentFolderId = typeof body.parentFolderId === "string" ? body.parentFolderId.trim() : null;
  const folders = Array.isArray(body.folders) ? body.folders : [];

  if (!workspaceId) return badRequest("workspaceId e obrigatorio.");
  if (folders.length === 0) return badRequest("folders deve ser um array nao vazio.");

  const parsed = folders.map((raw) => ({
    raw,
    segments: typeof raw === "string" ? splitPathSegments(raw) : [],
  }));
  if (parsed.some((entry) => entry.segments.length === 0)) {
    return badRequest("Todos os caminhos de pasta devem ser validos.");
  }
  for (const entry of parsed) {
    for (const segment of entry.segments) {
      if (segment.length > MAX_FOLDER_NAME_LENGTH) {
        return badRequest(`name deve ter no maximo ${MAX_FOLDER_NAME_LENGTH} caracteres.`);
      }
    }
  }

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");

    const ddb = getDocClient();
    const tableName = getTableName();

    const listRes = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `WORKSPACE#${workspaceId}`,
          ":skPrefix": "FOLDER#",
        },
        ProjectionExpression: "folderId, #name, parentFolderId",
        ExpressionAttributeNames: {
          "#name": "name",
        },
      }),
    );

    const existing = (listRes.Items ?? []) as FolderRow[];
    const byResolvedKey = new Map<string, { folderId: string; name: string }>();

    for (const row of existing) {
      if (!row.folderId || !row.name) continue;
      byResolvedKey.set(folderKey(row.parentFolderId ?? null, row.name), {
        folderId: row.folderId,
        name: row.name,
      });
    }

    const sorted = [...parsed].sort((a, b) => a.segments.length - b.segments.length);
    const mapping = new Map<string, string>();

    for (const entry of sorted) {
      let cursorParentId = parentFolderId;
      let currentPath = "";

      for (const segment of entry.segments) {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;
        if (mapping.has(currentPath)) {
          cursorParentId = mapping.get(currentPath) ?? null;
          continue;
        }

        const key = folderKey(cursorParentId, segment);
        const existingFolder = byResolvedKey.get(key);

        if (existingFolder) {
          mapping.set(currentPath, existingFolder.folderId);
          cursorParentId = existingFolder.folderId;
          continue;
        }

        const now = new Date().toISOString();
        const folderId = newFolderId();
        await ddb.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              PK: `WORKSPACE#${workspaceId}`,
              SK: `FOLDER#${folderId}`,
              folderId,
              workspaceId,
              name: segment,
              parentFolderId: cursorParentId,
              createdAt: now,
              updatedAt: now,
              createdByUserId: userId,
            },
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
          }),
        );

        byResolvedKey.set(key, { folderId, name: segment });
        mapping.set(currentPath, folderId);
        cursorParentId = folderId;
      }
    }

    const paths = Array.from(mapping.entries()).map(([path, folderId]) => ({ path, folderId }));
    return json(200, { items: paths });
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAuthorizedException") return unauthorized("Sessao expirada. Faca login novamente.");
    return serverError("Nao foi possivel resolver as pastas agora.");
  }
};

