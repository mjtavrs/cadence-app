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
    return { name: null as string | null, role: null as string | null };
  }

  const res = await fetch(new URL("workspaces", env.apiBaseUrl), {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return { name: null, role: null };

  const payload = (await res.json().catch(() => null)) as WorkspacesPayload | null;
  const workspaces = payload?.workspaces ?? [];
  const active = workspaces.find((workspace) => workspace.id === workspaceId);

  return {
    name: active?.name ?? null,
    role: active?.role ?? null,
  };
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
