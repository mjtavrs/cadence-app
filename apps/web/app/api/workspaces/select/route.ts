import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { cookies } from "next/headers";
import { serializeCookie } from "@/lib/cookies";

const ACCESS_COOKIE = "cadence_access";
const WORKSPACE_COOKIE = "cadence_workspace";

type SelectBody = {
  workspaceId?: string;
};

export async function POST(req: Request) {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as SelectBody | null;
  const workspaceId = body?.workspaceId?.trim();
  if (!workspaceId) {
    return NextResponse.json({ message: "workspaceId é obrigatório." }, { status: 400 });
  }

  // Persiste preferência no backend para sincronizar entre dispositivos.
  const persistRes = await fetch(new URL("workspaces/active", env.apiBaseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ workspaceId }),
  });

  if (!persistRes.ok) {
    const payload = await persistRes.json().catch(() => null);
    return NextResponse.json(payload ?? { message: "Falha ao selecionar workspace." }, { status: persistRes.status });
  }

  const headers = new Headers();
  headers.append(
    "set-cookie",
    serializeCookie(WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      secure: env.cookie.secure,
      sameSite: "lax",
      domain: env.cookie.domain,
      // "Eterno" na prática: 5 anos.
      maxAgeSeconds: 60 * 60 * 24 * 365 * 5,
    }),
  );

  return NextResponse.json({ ok: true }, { status: 200, headers });
}

