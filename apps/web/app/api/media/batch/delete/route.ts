import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { cookies } from "next/headers";

const ACCESS_COOKIE = "cadence_access";
const WORKSPACE_COOKIE = "cadence_workspace";

type Body = {
  mediaIds?: string[];
};

export async function POST(req: Request) {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const workspaceId = store.get(WORKSPACE_COOKIE)?.value;

  if (!accessToken) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!workspaceId) return NextResponse.json({ message: "Workspace não selecionado." }, { status: 400 });

  let body: Body = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    return NextResponse.json({ message: "Body inválido (JSON)." }, { status: 400 });
  }

  const mediaIds = body.mediaIds ?? [];
  if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
    return NextResponse.json({ message: "mediaIds é obrigatório e deve ser um array não vazio." }, { status: 400 });
  }

  const url = new URL("media/batch/delete", env.apiBaseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ workspaceId, mediaIds }),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao excluir mídias." }, { status: res.status });
}
