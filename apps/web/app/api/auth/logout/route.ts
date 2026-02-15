import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { serializeCookie } from "@/lib/cookies";
import { cookies } from "next/headers";

const ACCESS_COOKIE = "cadence_access";
const REFRESH_COOKIE = "cadence_refresh";
const USERNAME_COOKIE = "cadence_username";
const NEW_PASSWORD_SESSION_COOKIE = "cadence_new_password_session";
const WORKSPACE_COOKIE = "cadence_workspace";

function expire(name: string) {
  return serializeCookie(name, "", {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: "lax",
    domain: env.cookie.domain,
    maxAgeSeconds: 0,
  });
}

export async function POST() {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;

  if (accessToken) {
    try {
      await fetch(new URL("auth/logout", env.apiBaseUrl), {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}` },
      });
    } catch {
      // Sempre limpa cookies mesmo se a API falhar (ex.: token já expirado).
    }
  }

  const headers = new Headers();
  headers.append("set-cookie", expire(ACCESS_COOKIE));
  headers.append("set-cookie", expire(REFRESH_COOKIE));
  headers.append("set-cookie", expire(USERNAME_COOKIE));
  headers.append("set-cookie", expire(NEW_PASSWORD_SESSION_COOKIE));
  headers.append("set-cookie", expire(WORKSPACE_COOKIE));
  return NextResponse.json({ ok: true }, { status: 200, headers });
}

