import { NextResponse } from "next/server";

import { env } from "@/lib/env";

import { getWorkspaceAuth } from "../../_auth";

export async function DELETE() {
  const auth = await getWorkspaceAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL("workspaces/connections/instagram", env.apiBaseUrl);
  url.searchParams.set("workspaceId", auth.workspaceId);

  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${auth.accessToken}`,
    },
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao desconectar Instagram." }, { status: res.status });
}
