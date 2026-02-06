import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { serializeCookie } from "@/lib/cookies";

const ACCESS_COOKIE = "cadence_access";
const REFRESH_COOKIE = "cadence_refresh";
const USERNAME_COOKIE = "cadence_username";
const NEW_PASSWORD_SESSION_COOKIE = "cadence_new_password_session";

type LoginBody = { email: string; password: string };

type LoginOkPayload = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

type NewPasswordRequiredPayload = {
  challenge: "NEW_PASSWORD_REQUIRED";
  session: string;
};

function isLoginOkPayload(value: unknown): value is LoginOkPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.accessToken === "string" &&
    typeof v.refreshToken === "string" &&
    typeof v.expiresIn === "number"
  );
}

function isNewPasswordRequiredPayload(value: unknown): value is NewPasswordRequiredPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.challenge === "NEW_PASSWORD_REQUIRED" && typeof v.session === "string" && v.session.length > 0;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as LoginBody | null;
  if (!body?.email || !body.password) {
    return NextResponse.json({ message: "Informe email e senha." }, { status: 400 });
  }

  const res = await fetch(new URL("auth/login", env.apiBaseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: body.email, password: body.password }),
  });

  const payload = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    if (res.status === 409 && isNewPasswordRequiredPayload(payload)) {
      const headers = new Headers();
      headers.append(
        "set-cookie",
        serializeCookie(NEW_PASSWORD_SESSION_COOKIE, payload.session, {
          httpOnly: true,
          secure: env.cookie.secure,
          sameSite: "lax",
          domain: env.cookie.domain,
          maxAgeSeconds: 10 * 60,
        }),
      );
      headers.append(
        "set-cookie",
        serializeCookie(USERNAME_COOKIE, body.email, {
          httpOnly: true,
          secure: env.cookie.secure,
          sameSite: "lax",
          domain: env.cookie.domain,
          maxAgeSeconds: 10 * 60,
        }),
      );

      return NextResponse.json({ challenge: "NEW_PASSWORD_REQUIRED" }, { status: 409, headers });
    }

    return NextResponse.json(payload ?? { message: "Falha no login." }, { status: res.status });
  }

  if (!isLoginOkPayload(payload)) {
    return NextResponse.json({ message: "Resposta inválida do servidor." }, { status: 502 });
  }

  const { accessToken, refreshToken, expiresIn } = payload;

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
  headers.append(
    "set-cookie",
    serializeCookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: env.cookie.secure,
      sameSite: "lax",
      domain: env.cookie.domain,
      maxAgeSeconds: 60 * 60 * 24 * 30,
    }),
  );
  headers.append(
    "set-cookie",
    serializeCookie(USERNAME_COOKIE, body.email, {
      httpOnly: true,
      secure: env.cookie.secure,
      sameSite: "lax",
      domain: env.cookie.domain,
      maxAgeSeconds: 60 * 60 * 24 * 30,
    }),
  );

  return NextResponse.json({ ok: true }, { status: 200, headers });
}

