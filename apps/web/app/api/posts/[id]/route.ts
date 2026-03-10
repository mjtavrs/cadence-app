import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { cookies } from "next/headers";

const ACCESS_COOKIE = "cadence_access";
const WORKSPACE_COOKIE = "cadence_workspace";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const workspaceId = store.get(WORKSPACE_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!workspaceId) return NextResponse.json({ message: "Workspace não selecionado." }, { status: 400 });

  const { id } = await ctx.params;
  const url = new URL(`posts/${encodeURIComponent(id)}`, env.apiBaseUrl);
  url.searchParams.set("workspaceId", workspaceId);

  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao carregar post." }, { status: res.status });
}

type UpdateBody = {
  title?: string;
  caption?: string;
  mediaIds?: string[];
  tags?: string[];
  aspectRatio?: string;
  cropX?: number;
  cropY?: number;
  channels?: Array<{ platform: string; placement: string }>;
};

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const workspaceId = store.get(WORKSPACE_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!workspaceId) return NextResponse.json({ message: "Workspace não selecionado." }, { status: 400 });

  const body = (await req.json().catch(() => null)) as UpdateBody | null;
  if (!body || typeof body.caption !== "string" || !body.mediaIds) {
    return NextResponse.json({ message: "Parâmetros inválidos." }, { status: 400 });
  }

  const { id } = await ctx.params;
  const url = new URL(`posts/${encodeURIComponent(id)}`, env.apiBaseUrl);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      workspaceId,
      title: body.title,
      caption: body.caption,
      mediaIds: body.mediaIds,
      tags: body.tags ?? [],
      aspectRatio: body.aspectRatio,
      cropX: body.cropX,
      cropY: body.cropY,
      channels: body.channels,
    }),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao atualizar post." }, { status: res.status });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const workspaceId = store.get(WORKSPACE_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!workspaceId) return NextResponse.json({ message: "Workspace não selecionado." }, { status: 400 });

  const { id } = await ctx.params;
  const url = new URL(`posts/${encodeURIComponent(id)}`, env.apiBaseUrl);
  url.searchParams.set("workspaceId", workspaceId);

  const res = await fetch(url, {
    method: "DELETE",
    headers: { authorization: `Bearer ${accessToken}` },
  });

  const result = await res.json().catch(() => null);
  return NextResponse.json(result ?? { message: "Falha ao deletar post." }, { status: res.status });
}
