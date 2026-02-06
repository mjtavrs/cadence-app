import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { cookies } from "next/headers";

const ACCESS_COOKIE = "cadence_access";
const WORKSPACE_COOKIE = "cadence_workspace";

type Body = {
  contentType?: string;
  fileName?: string;
  sizeBytes?: number;
};

export async function POST(req: Request) {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const workspaceId = store.get(WORKSPACE_COOKIE)?.value;

  if (!accessToken) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!workspaceId) return NextResponse.json({ message: "Workspace não selecionado." }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.contentType || !body?.sizeBytes) {
    return NextResponse.json({ message: "Parâmetros inválidos." }, { status: 400 });
  }

  const res = await fetch(new URL("media/presign", env.apiBaseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      workspaceId,
      contentType: body.contentType,
      fileName: body.fileName,
      sizeBytes: body.sizeBytes,
    }),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao preparar upload." }, { status: res.status });
}

