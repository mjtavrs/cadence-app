import type { Metadata } from "next";
import { cookies } from "next/headers";

import { Page, PageDescription, PageHeader, PageHeaderText, PageTitle } from "@/components/page/page";
import { env } from "@/lib/env";
import { loadActiveWorkspaceOnServer } from "@/lib/server-session";

import { SettingsClient } from "./settings-client";
import type { InstagramConnection, WorkspaceMember, WorkspaceSettings } from "./types";

export const metadata: Metadata = {
  title: "Configurações",
};

const defaultSettings: WorkspaceSettings = {
  general: {
    workspaceName: null,
    workspaceLogoKey: null,
    workspaceLogoUrl: null,
    timezone: "America/Recife",
    locale: "pt-BR",
  },
  publishing: {
    requireApprovalForContributors: true,
    defaultChannels: [{ platform: "INSTAGRAM", placement: "FEED" }],
  },
  notifications: {
    emailOnPendingApproval: true,
    emailOnScheduled: true,
    emailOnPublished: true,
    emailOnFailed: true,
  },
  updatedAt: null,
  updatedByUserId: null,
};

const defaultConnection: InstagramConnection = {
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

async function loadSettingsOnServer() {
  const store = await cookies();
  const accessToken = store.get("cadence_access")?.value;
  const workspaceId = store.get("cadence_workspace")?.value;
  if (!accessToken || !workspaceId) return defaultSettings;

  const url = new URL("workspaces/settings", env.apiBaseUrl);
  url.searchParams.set("workspaceId", workspaceId);

  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!res.ok) return defaultSettings;

  const payload = (await res.json().catch(() => null)) as WorkspaceSettings | null;
  if (!payload) return defaultSettings;

  return {
    ...defaultSettings,
    ...payload,
    general: { ...defaultSettings.general, ...(payload.general ?? {}) },
    publishing: { ...defaultSettings.publishing, ...(payload.publishing ?? {}) },
    notifications: { ...defaultSettings.notifications, ...(payload.notifications ?? {}) },
  };
}

async function loadConnectionsOnServer() {
  const store = await cookies();
  const accessToken = store.get("cadence_access")?.value;
  const workspaceId = store.get("cadence_workspace")?.value;
  if (!accessToken || !workspaceId) return defaultConnection;

  const url = new URL("workspaces/connections", env.apiBaseUrl);
  url.searchParams.set("workspaceId", workspaceId);

  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!res.ok) return defaultConnection;

  const payload = (await res.json().catch(() => null)) as { instagram?: InstagramConnection } | null;
  return payload?.instagram ? { ...defaultConnection, ...payload.instagram } : defaultConnection;
}

async function loadMembersOnServer() {
  const store = await cookies();
  const accessToken = store.get("cadence_access")?.value;
  const workspaceId = store.get("cadence_workspace")?.value;
  if (!accessToken || !workspaceId) return [] as WorkspaceMember[];

  const url = new URL("workspaces/members", env.apiBaseUrl);
  url.searchParams.set("workspaceId", workspaceId);

  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!res.ok) return [] as WorkspaceMember[];

  const payload = (await res.json().catch(() => null)) as { items?: WorkspaceMember[] } | null;
  return payload?.items ?? [];
}

export default async function SettingsPage() {
  const [settings, connection, members, activeWorkspace] = await Promise.all([
    loadSettingsOnServer(),
    loadConnectionsOnServer(),
    loadMembersOnServer(),
    loadActiveWorkspaceOnServer(),
  ]);

  return (
    <Page>
      <PageHeader>
        <PageHeaderText>
          <PageTitle>Configurações</PageTitle>
          <PageDescription>Defina preferências do workspace, conexões e controle de membros.</PageDescription>
        </PageHeaderText>
      </PageHeader>

      <SettingsClient
        initialSettings={settings}
        initialConnection={connection}
        initialMembers={members}
        workspaceRole={activeWorkspace.role}
        workspaceName={activeWorkspace.name}
        workspaceLogoUrl={activeWorkspace.logoUrl}
      />
    </Page>
  );
}
