import { cookies } from "next/headers";

import { AppShellClient } from "@/components/shell/app-shell-client";
import { env } from "@/lib/env";

type WorkspacesPayload = {
  workspaces?: Array<{ id: string; name: string; role: string }>;
};

type MePayload = {
  name?: string | null;
  email?: string;
  avatar?: string | null;
};

async function loadActiveWorkspaceOnServer() {
  const store = await cookies();
  const accessToken = store.get("cadence_access")?.value;
  const workspaceId = store.get("cadence_workspace")?.value;
  if (!accessToken || !workspaceId) return { name: null as string | null, role: null as string | null };

  const res = await fetch(new URL("workspaces", env.apiBaseUrl), {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return { name: null, role: null };

  const payload = (await res.json().catch(() => null)) as WorkspacesPayload | null;
  const workspaces = payload?.workspaces ?? [];
  const active = workspaces.find((w) => w.id === workspaceId);
  return {
    name: active?.name ?? null,
    role: active?.role ?? null,
  };
}

async function loadUserOnServer() {
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

export default async function AppLayout(props: { children: React.ReactNode }) {
  const [activeWorkspace, user] = await Promise.all([loadActiveWorkspaceOnServer(), loadUserOnServer()]);
  return (
    <AppShellClient
      workspaceName={activeWorkspace.name}
      workspaceRole={activeWorkspace.role}
      user={user}
    >
      {props.children}
    </AppShellClient>
  );
}

