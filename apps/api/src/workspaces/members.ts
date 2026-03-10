import { BatchGetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { Role } from "../auth/rbac";

export type WorkspaceMember = {
  userId: string;
  role: Role;
  workspaceName: string | null;
};

export type UserProfileSummary = {
  userId: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
};

const ROLE_VALUES: Role[] = ["OWNER", "ADMIN", "EDITOR", "VIEWER"];
const ROLE_SET = new Set<Role>(ROLE_VALUES);

function parseRole(value: unknown): Role | null {
  if (typeof value !== "string") return null;
  const normalized = value.toUpperCase() as Role;
  return ROLE_SET.has(normalized) ? normalized : null;
}

function parseWorkspaceName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function extractUserId(pk: string): string | null {
  if (!pk.startsWith("USER#")) return null;
  const raw = pk.slice("USER#".length).trim();
  return raw || null;
}

async function scanMembershipRows(params: {
  ddb: { send: (command: any) => Promise<any> };
  tableName: string;
  workspaceId: string;
}) {
  const rows: Array<Record<string, unknown>> = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const res = await params.ddb.send(
      new ScanCommand({
        TableName: params.tableName,
        ProjectionExpression: "#pk, #sk, #workspaceId, #workspaceName, #role",
        ExpressionAttributeNames: {
          "#pk": "PK",
          "#sk": "SK",
          "#workspaceId": "workspaceId",
          "#workspaceName": "workspaceName",
          "#role": "role",
        },
        FilterExpression:
          "#workspaceId = :workspaceId AND begins_with(#pk, :pkPrefix) AND begins_with(#sk, :skPrefix)",
        ExpressionAttributeValues: {
          ":workspaceId": params.workspaceId,
          ":pkPrefix": "USER#",
          ":skPrefix": "WORKSPACE#",
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );

    rows.push(...((res.Items ?? []) as Array<Record<string, unknown>>));
    lastEvaluatedKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  return rows;
}

export async function listWorkspaceMembers(params: {
  ddb: { send: (command: any) => Promise<any> };
  tableName: string;
  workspaceId: string;
}): Promise<WorkspaceMember[]> {
  const rows = await scanMembershipRows(params);
  const out: WorkspaceMember[] = [];

  for (const row of rows) {
    const pk = typeof row.PK === "string" ? row.PK : "";
    const userId = extractUserId(pk);
    const role = parseRole(row.role);

    if (!userId || !role) continue;

    out.push({
      userId,
      role,
      workspaceName: parseWorkspaceName(row.workspaceName),
    });
  }

  return out;
}

export async function countWorkspaceOwners(params: {
  ddb: { send: (command: any) => Promise<any> };
  tableName: string;
  workspaceId: string;
}) {
  const members = await listWorkspaceMembers(params);
  return members.filter((member) => member.role === "OWNER").length;
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let idx = 0; idx < items.length; idx += chunkSize) {
    chunks.push(items.slice(idx, idx + chunkSize));
  }
  return chunks;
}

function parseProfileString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function loadProfilesByUserId(params: {
  ddb: { send: (command: any) => Promise<any> };
  tableName: string;
  userIds: string[];
}): Promise<Map<string, UserProfileSummary>> {
  const uniqueUserIds = Array.from(new Set(params.userIds.map((userId) => userId.trim()).filter(Boolean)));
  const map = new Map<string, UserProfileSummary>();
  if (uniqueUserIds.length === 0) return map;

  for (const chunk of chunkArray(uniqueUserIds, 100)) {
    const keys = chunk.map((userId) => ({ PK: `USER#${userId}`, SK: "PROFILE" }));

    const res = await params.ddb.send(
      new BatchGetCommand({
        RequestItems: {
          [params.tableName]: {
            Keys: keys,
            ProjectionExpression: "#pk, #name, #email, #avatar",
            ExpressionAttributeNames: {
              "#pk": "PK",
              "#name": "name",
              "#email": "email",
              "#avatar": "avatar",
            },
          },
        },
      }),
    );

    const responses = (res.Responses?.[params.tableName] ?? []) as Array<Record<string, unknown>>;
    for (const row of responses) {
      const pk = typeof row.PK === "string" ? row.PK : "";
      const userId = extractUserId(pk);
      if (!userId) continue;

      map.set(userId, {
        userId,
        name: parseProfileString(row.name),
        email: parseProfileString(row.email),
        avatar: parseProfileString(row.avatar),
      });
    }
  }

  return map;
}

export function roleSortWeight(role: Role) {
  if (role === "OWNER") return 0;
  if (role === "ADMIN") return 1;
  if (role === "EDITOR") return 2;
  return 3;
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLE_SET.has(value.toUpperCase() as Role);
}
