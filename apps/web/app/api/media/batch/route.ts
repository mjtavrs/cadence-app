import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { cookies } from "next/headers";

const ACCESS_COOKIE = "cadence_access";
const WORKSPACE_COOKIE = "cadence_workspace";

type MediaItemInput = {
  mediaId?: string;
  s3Key?: string;
  contentType?: string;
  sizeBytes?: number;
  fileName?: string;
};

type Body = {
  folderId?: string | null;
  items?: MediaItemInput[];
};

export async function POST(req: Request) {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const workspaceId = store.get(WORKSPACE_COOKIE)?.value;

  if (!accessToken) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!workspaceId) return NextResponse.json({ message: "Workspace não selecionado." }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ message: "items é obrigatório e deve ser um array não vazio." }, { status: 400 });
  }

  const res = await fetch(new URL("media/batch", env.apiBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      workspaceId,
      folderId: typeof body.folderId === "string" ? body.folderId : null,
      items: body.items,
    }),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao registrar mídia." }, { status: res.status });
}
