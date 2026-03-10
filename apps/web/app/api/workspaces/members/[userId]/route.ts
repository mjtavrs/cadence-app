import { NextResponse } from "next/server";

import { env } from "@/lib/env";

import { getWorkspaceAuth } from "../../_auth";

type PatchBody = {
  role?: string;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const auth = await getWorkspaceAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body || typeof body.role !== "string" || !body.role.trim()) {
    return NextResponse.json({ message: "role é obrigatório." }, { status: 400 });
  }

  const { userId } = await ctx.params;

  const res = await fetch(new URL(`workspaces/members/${encodeURIComponent(userId)}`, env.apiBaseUrl), {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth.accessToken}`,
    },
    body: JSON.stringify({
      workspaceId: auth.workspaceId,
      role: body.role.trim(),
    }),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao atualizar role do membro." }, { status: res.status });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ userId: string }> }) {
  const auth = await getWorkspaceAuth();
  if (auth instanceof NextResponse) return auth;

  const { userId } = await ctx.params;

  const res = await fetch(new URL(`workspaces/members/${encodeURIComponent(userId)}`, env.apiBaseUrl), {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth.accessToken}`,
    },
    body: JSON.stringify({ workspaceId: auth.workspaceId }),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao remover membro." }, { status: res.status });
}
