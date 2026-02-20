import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { cookies } from "next/headers";

const ACCESS_COOKIE = "cadence_access";
const WORKSPACE_COOKIE = "cadence_workspace";

type FileInput = {
  contentType?: string;
  fileName?: string;
  sizeBytes?: number;
};

type Body = {
  files?: FileInput[];
};

export async function POST(req: Request) {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const workspaceId = store.get(WORKSPACE_COOKIE)?.value;

  if (!accessToken) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!workspaceId) return NextResponse.json({ message: "Workspace não selecionado." }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.files || !Array.isArray(body.files) || body.files.length === 0) {
    return NextResponse.json({ message: "files é obrigatório e deve ser um array não vazio." }, { status: 400 });
  }

  const res = await fetch(new URL("media/presign/batch", env.apiBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      workspaceId,
      files: body.files,
    }),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao preparar upload." }, { status: res.status });
}
