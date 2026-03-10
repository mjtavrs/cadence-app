import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { cookies } from "next/headers";

const ACCESS_COOKIE = "cadence_access";
const WORKSPACE_COOKIE = "cadence_workspace";

type Body = {
  parentFolderId?: string | null;
  folders?: string[];
};

export async function POST(req: Request) {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const workspaceId = store.get(WORKSPACE_COOKIE)?.value;

  if (!accessToken) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!workspaceId) return NextResponse.json({ message: "Workspace não selecionado." }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.folders || !Array.isArray(body.folders) || body.folders.length === 0) {
    return NextResponse.json({ message: "folders é obrigatório e deve ser um array não vazio." }, { status: 400 });
  }

  const res = await fetch(new URL("media/folders/resolve-tree", env.apiBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      workspaceId,
      parentFolderId: typeof body.parentFolderId === "string" ? body.parentFolderId : null,
      folders: body.folders,
    }),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao resolver árvore de pastas." }, { status: res.status });
}

