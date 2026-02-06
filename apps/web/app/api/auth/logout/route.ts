import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { serializeCookie } from "@/lib/cookies";

const ACCESS_COOKIE = "cadence_access";
const REFRESH_COOKIE = "cadence_refresh";
const USERNAME_COOKIE = "cadence_username";
const NEW_PASSWORD_SESSION_COOKIE = "cadence_new_password_session";

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
  const headers = new Headers();
  headers.append("set-cookie", expire(ACCESS_COOKIE));
  headers.append("set-cookie", expire(REFRESH_COOKIE));
  headers.append("set-cookie", expire(USERNAME_COOKIE));
  headers.append("set-cookie", expire(NEW_PASSWORD_SESSION_COOKIE));
  return NextResponse.json({ ok: true }, { status: 200, headers });
}

