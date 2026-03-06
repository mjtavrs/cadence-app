import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { env } from "@/lib/env";

const ACCESS_COOKIE = "cadence_access";
const WORKSPACE_COOKIE = "cadence_workspace";

type Body = {
  reason?: string;
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const workspaceId = store.get(WORKSPACE_COOKIE)?.value;

  if (!accessToken) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!workspaceId) return NextResponse.json({ message: "Workspace não selecionado." }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.reason || !body.reason.trim()) {
    return NextResponse.json({ message: "Informe o motivo da sinalização." }, { status: 400 });
  }

  const { id } = await ctx.params;
  const url = new URL(`posts/${encodeURIComponent(id)}/flag`, env.apiBaseUrl);

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      workspaceId,
      reason: body.reason.trim(),
    }),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao sinalizar post." }, { status: res.status });
}
