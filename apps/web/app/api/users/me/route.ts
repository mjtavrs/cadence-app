import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { cookies } from "next/headers";

const ACCESS_COOKIE = "cadence_access";

export async function PATCH(req: Request) {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Body inválido (JSON)." }, { status: 400 });
  }

  const res = await fetch(new URL("users/me", env.apiBaseUrl), {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao atualizar perfil." }, { status: res.status });
}
