import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { env } from "@/lib/env";

const ACCESS_COOKIE = "cadence_access";
const WORKSPACE_COOKIE = "cadence_workspace";

type RenameFolderBody = {
  name?: string;
};

async function getAuth() {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const workspaceId = store.get(WORKSPACE_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!workspaceId) return NextResponse.json({ message: "Workspace não selecionado." }, { status: 400 });
  return { accessToken, workspaceId } as const;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => null)) as RenameFolderBody | null;
  if (!body?.name || !body.name.trim()) {
    return NextResponse.json({ message: "name é obrigatório." }, { status: 400 });
  }

  const { id } = await ctx.params;
  const url = new URL(`media/folders/${encodeURIComponent(id)}`, env.apiBaseUrl);
  url.searchParams.set("workspaceId", auth.workspaceId);

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth.accessToken}`,
    },
    body: JSON.stringify({ name: body.name.trim() }),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao renomear pasta." }, { status: res.status });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const url = new URL(`media/folders/${encodeURIComponent(id)}`, env.apiBaseUrl);
  url.searchParams.set("workspaceId", auth.workspaceId);

  const res = await fetch(url, {
    method: "DELETE",
    headers: { authorization: `Bearer ${auth.accessToken}` },
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao excluir pasta." }, { status: res.status });
}
