export type PostChannel = {
  platform: string;
  placement: string;
};

export type WorkspaceSettings = {
  general: {
    workspaceName: string | null;
    workspaceLogoKey: string | null;
    workspaceLogoUrl: string | null;
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
  updatedAt: string | null;
  updatedByUserId: string | null;
};

export type InstagramConnection = {
  provider: "INSTAGRAM";
  status: "DISCONNECTED" | "PENDING" | "CONNECTED" | "ERROR";
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

export type WorkspaceMember = {
  userId: string;
  role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
  name: string | null;
  email: string | null;
  avatar: string | null;
  workspaceName: string | null;
  isCurrentUser: boolean;
};
