import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { cookies } from "next/headers";

const ACCESS_COOKIE = "cadence_access";
const WORKSPACE_COOKIE = "cadence_workspace";

export async function GET(req: Request) {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const workspaceId = store.get(WORKSPACE_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!workspaceId) return NextResponse.json({ message: "Workspace não selecionado." }, { status: 400 });

  const url = new URL("posts", env.apiBaseUrl);
  url.searchParams.set("workspaceId", workspaceId);

  const reqUrl = new URL(req.url);
  const week = reqUrl.searchParams.get("week");
  const status = reqUrl.searchParams.get("status");
  if (week) url.searchParams.set("week", week);
  if (status) url.searchParams.set("status", status);

  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao listar posts." }, { status: res.status });
}

type CreateBody = {
  caption?: string;
  mediaIds?: string[];
};

export async function POST(req: Request) {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const workspaceId = store.get(WORKSPACE_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!workspaceId) return NextResponse.json({ message: "Workspace não selecionado." }, { status: 400 });

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body?.caption || !body.mediaIds) {
    return NextResponse.json({ message: "Parâmetros inválidos." }, { status: 400 });
  }

  const res = await fetch(new URL("posts", env.apiBaseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      workspaceId,
      caption: body.caption,
      mediaIds: body.mediaIds,
    }),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao criar post." }, { status: res.status });
}

