import { cookies } from "next/headers";

import { env } from "@/lib/env";

export type AppUser = {
  name: string | null;
  email: string | null;
  avatar: string | null;
} | null;

type WorkspacesPayload = {
  workspaces?: Array<{ id: string; name: string; role: string }>;
};

type WorkspaceSettingsPayload = {
  general?: {
    workspaceLogoUrl?: string | null;
  };
};

type MePayload = {
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
};

export async function loadActiveWorkspaceOnServer() {
  const store = await cookies();
  const accessToken = store.get("cadence_access")?.value;
  const workspaceId = store.get("cadence_workspace")?.value;
  if (!accessToken || !workspaceId) {
    return { name: null as string | null, role: null as string | null, logoUrl: null as string | null };
  }

  const [workspacesRes, settingsRes] = await Promise.all([
    fetch(new URL("workspaces", env.apiBaseUrl), {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }),
    fetch(new URL(`workspaces/settings?workspaceId=${encodeURIComponent(workspaceId)}`, env.apiBaseUrl), {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }),
  ]);

  let name: string | null = null;
  let role: string | null = null;
  let logoUrl: string | null = null;

  if (workspacesRes.ok) {
    const payload = (await workspacesRes.json().catch(() => null)) as WorkspacesPayload | null;
    const workspaces = payload?.workspaces ?? [];
    const active = workspaces.find((workspace) => workspace.id === workspaceId);
    name = active?.name ?? null;
    role = active?.role ?? null;
  }

  if (settingsRes.ok) {
    const payload = (await settingsRes.json().catch(() => null)) as WorkspaceSettingsPayload | null;
    logoUrl = payload?.general?.workspaceLogoUrl ?? null;
  }

  return { name, role, logoUrl };
}

export async function loadUserOnServer(): Promise<AppUser> {
  const store = await cookies();
  const accessToken = store.get("cadence_access")?.value;
  if (!accessToken) return null;

  const res = await fetch(new URL("auth/me", env.apiBaseUrl), {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const payload = (await res.json().catch(() => null)) as MePayload | null;
  if (!payload) return null;

  return {
    name: payload.name ?? null,
    email: payload.email ?? null,
    avatar: payload.avatar ?? null,
  };
}
