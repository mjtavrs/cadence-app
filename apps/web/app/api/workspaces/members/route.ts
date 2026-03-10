import { NextResponse } from "next/server";

import { env } from "@/lib/env";

import { getWorkspaceAuth } from "../_auth";

export async function GET() {
  const auth = await getWorkspaceAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL("workspaces/members", env.apiBaseUrl);
  url.searchParams.set("workspaceId", auth.workspaceId);

  const res = await fetch(url, {
    headers: { authorization: `Bearer ${auth.accessToken}` },
    cache: "no-store",
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao listar membros." }, { status: res.status });
}
