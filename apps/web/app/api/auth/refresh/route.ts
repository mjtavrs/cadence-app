import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { cookies } from "next/headers";
import { serializeCookie } from "@/lib/cookies";

const ACCESS_COOKIE = "cadence_access";
const REFRESH_COOKIE = "cadence_refresh";
const USERNAME_COOKIE = "cadence_username";

type RefreshOkPayload = {
  accessToken: string;
  expiresIn: number;
};

function isRefreshOkPayload(value: unknown): value is RefreshOkPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.accessToken === "string" && typeof v.expiresIn === "number";
}

export async function POST() {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  const username = store.get(USERNAME_COOKIE)?.value;

  if (!refreshToken || !username) {
    return NextResponse.json({ message: "Sessão expirada." }, { status: 401 });
  }

  const res = await fetch(new URL("auth/refresh", env.apiBaseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken, username }),
  });

  const payload = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    return NextResponse.json(payload ?? { message: "Falha ao atualizar sessão." }, { status: res.status });
  }

  if (!isRefreshOkPayload(payload)) {
    return NextResponse.json({ message: "Resposta inválida do servidor." }, { status: 502 });
  }

  const { accessToken, expiresIn } = payload;

  const headers = new Headers();
  headers.append(
    "set-cookie",
    serializeCookie(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      secure: env.cookie.secure,
      sameSite: "lax",
      domain: env.cookie.domain,
      maxAgeSeconds: expiresIn,
    }),
  );

  return NextResponse.json({ ok: true }, { status: 200, headers });
}

