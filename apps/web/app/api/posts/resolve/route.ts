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

  const reqUrl = new URL(req.url);
  const code = reqUrl.searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ message: "code é obrigatório." }, { status: 400 });

  const url = new URL("posts/resolve", env.apiBaseUrl);
  url.searchParams.set("workspaceId", workspaceId);
  url.searchParams.set("code", code);

  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao resolver código." }, { status: res.status });
}

