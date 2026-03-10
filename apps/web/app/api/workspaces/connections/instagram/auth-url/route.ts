import { NextResponse } from "next/server";

import { env } from "@/lib/env";

import { getWorkspaceAuth } from "../../../_auth";

export async function POST() {
  const auth = await getWorkspaceAuth();
  if (auth instanceof NextResponse) return auth;

  const res = await fetch(new URL("workspaces/connections/instagram/auth-url", env.apiBaseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth.accessToken}`,
    },
    body: JSON.stringify({ workspaceId: auth.workspaceId }),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao iniciar conexão com Instagram." }, { status: res.status });
}
