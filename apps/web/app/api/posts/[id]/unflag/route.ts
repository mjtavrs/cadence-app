import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { env } from "@/lib/env";

const ACCESS_COOKIE = "cadence_access";
const WORKSPACE_COOKIE = "cadence_workspace";

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const workspaceId = store.get(WORKSPACE_COOKIE)?.value;

  if (!accessToken) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!workspaceId) return NextResponse.json({ message: "Workspace não selecionado." }, { status: 400 });

  const { id } = await ctx.params;
  const url = new URL(`posts/${encodeURIComponent(id)}/unflag`, env.apiBaseUrl);

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ workspaceId }),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao dessinalizar post." }, { status: res.status });
}
