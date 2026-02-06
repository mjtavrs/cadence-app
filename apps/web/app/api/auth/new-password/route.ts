import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { cookies } from "next/headers";
import { serializeCookie } from "@/lib/cookies";

const ACCESS_COOKIE = "cadence_access";
const REFRESH_COOKIE = "cadence_refresh";
const USERNAME_COOKIE = "cadence_username";
const NEW_PASSWORD_SESSION_COOKIE = "cadence_new_password_session";

function safeDecode(value: string) {
  try {
    // If it was encoded when written, decode here; if it's already decoded, this is a no-op for most values.
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

type NewPasswordBody = {
  newPassword?: string;
};

type NewPasswordOkPayload = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

function isNewPasswordOkPayload(value: unknown): value is NewPasswordOkPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.accessToken === "string" &&
    typeof v.refreshToken === "string" &&
    typeof v.expiresIn === "number"
  );
}

function expire(name: string) {
  return serializeCookie(name, "", {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: "lax",
    domain: env.cookie.domain,
    maxAgeSeconds: 0,
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as NewPasswordBody | null;
  const newPassword = body?.newPassword;
  if (!newPassword) {
    return NextResponse.json({ message: "Informe a nova senha." }, { status: 400 });
  }

  const store = await cookies();
  const sessionRaw = store.get(NEW_PASSWORD_SESSION_COOKIE)?.value;
  const usernameRaw = store.get(USERNAME_COOKIE)?.value;
  const session = sessionRaw ? safeDecode(sessionRaw) : undefined;
  const username = usernameRaw ? safeDecode(usernameRaw) : undefined;
  if (!session || !username) {
    return NextResponse.json({ message: "Sessão expirada. Faça login novamente." }, { status: 401 });
  }

  const res = await fetch(new URL("auth/new-password", env.apiBaseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, session, newPassword }),
  });

  const payload = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    return NextResponse.json(payload ?? { message: "Falha ao definir nova senha." }, { status: res.status });
  }

  if (!isNewPasswordOkPayload(payload)) {
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
  headers.append("set-cookie", expire(NEW_PASSWORD_SESSION_COOKIE));

  return NextResponse.json({ ok: true }, { status: 200, headers });
}

