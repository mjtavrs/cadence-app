export const INSTAGRAM_AUTH_SK = "INSTAGRAM_AUTH";

export type InstagramConnectionStatus = "DISCONNECTED" | "PENDING" | "CONNECTED" | "ERROR";

export type InstagramConnection = {
  provider: "INSTAGRAM";
  status: InstagramConnectionStatus;
  connected: boolean;
  accountId: string | null;
  accountUsername: string | null;
  tokenExpiresAt: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
  oauthState: string | null;
  lastError: string | null;
  updatedAt: string | null;
  updatedByUserId: string | null;
};

export const DEFAULT_INSTAGRAM_CONNECTION: InstagramConnection = {
  provider: "INSTAGRAM",
  status: "DISCONNECTED",
  connected: false,
  accountId: null,
  accountUsername: null,
  tokenExpiresAt: null,
  connectedAt: null,
  disconnectedAt: null,
  oauthState: null,
  lastError: null,
  updatedAt: null,
  updatedByUserId: null,
};

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function instagramConnectionKey(workspaceId: string) {
  return {
    PK: `WORKSPACE#${workspaceId}`,
    SK: INSTAGRAM_AUTH_SK,
  };
}

export function normalizeInstagramConnection(item: unknown): InstagramConnection {
  const base = structuredClone(DEFAULT_INSTAGRAM_CONNECTION);
  if (!item || typeof item !== "object") return base;

  const row = item as Record<string, unknown>;
  const status = readString(row.status)?.toUpperCase();
  if (status === "PENDING" || status === "CONNECTED" || status === "ERROR" || status === "DISCONNECTED") {
    base.status = status;
  }

  base.connected = base.status === "CONNECTED";
  base.accountId = readString(row.accountId);
  base.accountUsername = readString(row.accountUsername);
  base.tokenExpiresAt = readString(row.tokenExpiresAt);
  base.connectedAt = readString(row.connectedAt);
  base.disconnectedAt = readString(row.disconnectedAt);
  base.oauthState = readString(row.oauthState);
  base.lastError = readString(row.lastError);
  base.updatedAt = readString(row.updatedAt);
  base.updatedByUserId = readString(row.updatedByUserId);

  return base;
}
