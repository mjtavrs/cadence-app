import { DEFAULT_POST_CHANNELS, normalizePostChannels, type PostChannel } from "../posts/channels";

export const WORKSPACE_SETTINGS_SK = "SETTINGS";

export type WorkspaceSettings = {
  general: {
    workspaceName: string | null;
    workspaceLogoKey: string | null;
    timezone: string;
    locale: string;
  };
  publishing: {
    requireApprovalForContributors: boolean;
    defaultChannels: PostChannel[];
  };
  notifications: {
    emailOnPendingApproval: boolean;
    emailOnScheduled: boolean;
    emailOnPublished: boolean;
    emailOnFailed: boolean;
  };
  createdAt: string | null;
  updatedAt: string | null;
  updatedByUserId: string | null;
};

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  general: {
    workspaceName: null,
    workspaceLogoKey: null,
    timezone: "America/Recife",
    locale: "pt-BR",
  },
  publishing: {
    requireApprovalForContributors: true,
    defaultChannels: [...DEFAULT_POST_CHANNELS],
  },
  notifications: {
    emailOnPendingApproval: true,
    emailOnScheduled: true,
    emailOnPublished: true,
    emailOnFailed: true,
  },
  createdAt: null,
  updatedAt: null,
  updatedByUserId: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

export function workspaceSettingsKey(workspaceId: string) {
  return {
    PK: `WORKSPACE#${workspaceId}`,
    SK: WORKSPACE_SETTINGS_SK,
  };
}

export function normalizeWorkspaceSettings(item: unknown): WorkspaceSettings {
  const base = structuredClone(DEFAULT_WORKSPACE_SETTINGS);
  if (!isRecord(item)) return base;

  const general = isRecord(item.general) ? item.general : null;
  const publishing = isRecord(item.publishing) ? item.publishing : null;
  const notifications = isRecord(item.notifications) ? item.notifications : null;

  const workspaceName = general ? readString(general.workspaceName) : null;
  if (workspaceName !== null) base.general.workspaceName = workspaceName;

  const workspaceLogoKey = general ? readString(general.workspaceLogoKey) : null;
  if (workspaceLogoKey !== null) base.general.workspaceLogoKey = workspaceLogoKey;

  const timezone = general ? readString(general.timezone) : null;
  if (timezone !== null) base.general.timezone = timezone;

  const locale = general ? readString(general.locale) : null;
  if (locale !== null) base.general.locale = locale;

  const requireApprovalForContributors = publishing
    ? readBoolean(publishing.requireApprovalForContributors)
    : null;
  if (requireApprovalForContributors !== null) {
    base.publishing.requireApprovalForContributors = requireApprovalForContributors;
  }

  if (publishing && Array.isArray(publishing.defaultChannels)) {
    base.publishing.defaultChannels = normalizePostChannels(publishing.defaultChannels);
  }

  const emailOnPendingApproval = notifications ? readBoolean(notifications.emailOnPendingApproval) : null;
  if (emailOnPendingApproval !== null) base.notifications.emailOnPendingApproval = emailOnPendingApproval;

  const emailOnScheduled = notifications ? readBoolean(notifications.emailOnScheduled) : null;
  if (emailOnScheduled !== null) base.notifications.emailOnScheduled = emailOnScheduled;

  const emailOnPublished = notifications ? readBoolean(notifications.emailOnPublished) : null;
  if (emailOnPublished !== null) base.notifications.emailOnPublished = emailOnPublished;

  const emailOnFailed = notifications ? readBoolean(notifications.emailOnFailed) : null;
  if (emailOnFailed !== null) base.notifications.emailOnFailed = emailOnFailed;

  base.createdAt = readString(item.createdAt);
  base.updatedAt = readString(item.updatedAt);
  base.updatedByUserId = readString(item.updatedByUserId);

  return base;
}
