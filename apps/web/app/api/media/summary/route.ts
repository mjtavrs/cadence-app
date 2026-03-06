import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { env } from "@/lib/env";

const ACCESS_COOKIE = "cadence_access";
const WORKSPACE_COOKIE = "cadence_workspace";

export async function GET() {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const workspaceId = store.get(WORKSPACE_COOKIE)?.value;

  if (!accessToken) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!workspaceId) return NextResponse.json({ message: "Workspace não selecionado." }, { status: 400 });

  const url = new URL("media/summary", env.apiBaseUrl);
  url.searchParams.set("workspaceId", workspaceId);

  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao carregar o resumo de armazenamento." }, { status: res.status });
}
