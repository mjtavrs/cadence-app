import { cookies } from "next/headers";

import { AppShellClient } from "@/components/shell/app-shell-client";
import { env } from "@/lib/env";

type WorkspacesPayload = {
  workspaces?: Array<{ id: string; name: string }>;
};

async function loadWorkspaceNameOnServer() {
  const store = await cookies();
  const accessToken = store.get("cadence_access")?.value;
  const workspaceId = store.get("cadence_workspace")?.value;
  if (!accessToken || !workspaceId) return null;

  const res = await fetch(new URL("workspaces", env.apiBaseUrl), {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const payload = (await res.json().catch(() => null)) as WorkspacesPayload | null;
  const workspaces = payload?.workspaces ?? [];
  return workspaces.find((w) => w.id === workspaceId)?.name ?? null;
}

export default async function AppLayout(props: { children: React.ReactNode }) {
  const workspaceName = await loadWorkspaceNameOnServer();
  return <AppShellClient workspaceName={workspaceName}>{props.children}</AppShellClient>;
}

