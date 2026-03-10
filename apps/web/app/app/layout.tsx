import { AppShellClient } from "@/components/shell/app-shell-client";
import { loadActiveWorkspaceOnServer, loadUserOnServer } from "@/lib/server-session";

export default async function AppLayout(props: { children: React.ReactNode }) {
  const [activeWorkspace, user] = await Promise.all([loadActiveWorkspaceOnServer(), loadUserOnServer()]);

  return (
    <AppShellClient
      workspaceName={activeWorkspace.name}
      workspaceRole={activeWorkspace.role}
      workspaceLogoUrl={activeWorkspace.logoUrl}
      user={user}
    >
      {props.children}
    </AppShellClient>
  );
}
