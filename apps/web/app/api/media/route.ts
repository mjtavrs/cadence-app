import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { cookies } from "next/headers";

const ACCESS_COOKIE = "cadence_access";
const WORKSPACE_COOKIE = "cadence_workspace";

export async function GET() {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const workspaceId = store.get(WORKSPACE_COOKIE)?.value;

  if (!accessToken) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!workspaceId) return NextResponse.json({ message: "Workspace não selecionado." }, { status: 400 });

  const url = new URL("media", env.apiBaseUrl);
  url.searchParams.set("workspaceId", workspaceId);

  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao listar mídias." }, { status: res.status });
}

type CreateBody = {
  mediaId?: string;
  s3Key?: string;
  contentType?: string;
  sizeBytes?: number;
  fileName?: string;
  folderId?: string | null;
};

export async function POST(req: Request) {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const workspaceId = store.get(WORKSPACE_COOKIE)?.value;

  if (!accessToken) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!workspaceId) return NextResponse.json({ message: "Workspace não selecionado." }, { status: 400 });

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body?.mediaId || !body?.s3Key || !body?.contentType || !body?.sizeBytes) {
    return NextResponse.json({ message: "Parâmetros inválidos." }, { status: 400 });
  }

  const res = await fetch(new URL("media", env.apiBaseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      workspaceId,
      mediaId: body.mediaId,
      s3Key: body.s3Key,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      fileName: body.fileName,
      folderId: typeof body.folderId === "string" ? body.folderId : null,
    }),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao registrar mídia." }, { status: res.status });
}

