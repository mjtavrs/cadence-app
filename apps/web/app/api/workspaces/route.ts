import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { cookies } from "next/headers";

const ACCESS_COOKIE = "cadence_access";

export async function GET() {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  const res = await fetch(new URL("workspaces", env.apiBaseUrl), {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao carregar workspaces." }, { status: res.status });
}

