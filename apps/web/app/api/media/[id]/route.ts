import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { cookies } from "next/headers";

const ACCESS_COOKIE = "cadence_access";
const WORKSPACE_COOKIE = "cadence_workspace";

async function getAuth() {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const workspaceId = store.get(WORKSPACE_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!workspaceId) return NextResponse.json({ message: "Workspace não selecionado." }, { status: 400 });
  return { accessToken, workspaceId } as const;
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const url = new URL(`media/${encodeURIComponent(id)}`, env.apiBaseUrl);
  url.searchParams.set("workspaceId", auth.workspaceId);

  const res = await fetch(url, { method: "DELETE", headers: { authorization: `Bearer ${auth.accessToken}` } });
  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao deletar mídia." }, { status: res.status });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuth();
  if (auth instanceof NextResponse) return auth;

  let body: { fileName?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Body inválido (JSON)." }, { status: 400 });
  }

  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  if (!fileName) return NextResponse.json({ message: "fileName é obrigatório." }, { status: 400 });

  const { id } = await ctx.params;
  const url = new URL(`media/${encodeURIComponent(id)}`, env.apiBaseUrl);
  url.searchParams.set("workspaceId", auth.workspaceId);

  const res = await fetch(url, {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: `Bearer ${auth.accessToken}` },
    body: JSON.stringify({ fileName }),
  });
  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao renomear mídia." }, { status: res.status });
}