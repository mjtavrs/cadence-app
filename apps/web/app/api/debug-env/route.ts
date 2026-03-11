import { NextResponse } from "next/server";

function sanitizeUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return "invalid-url";
  }
}

export async function GET() {
  const apiBaseUrl = process.env.CADENCE_API_BASE_URL;
  const cookieSecure = process.env.CADENCE_COOKIE_SECURE;
  const cookieDomain = process.env.CADENCE_COOKIE_DOMAIN;

  return NextResponse.json(
    {
      hasApiBaseUrl: Boolean(apiBaseUrl && apiBaseUrl.trim().length > 0),
      apiBaseUrlSanitized: sanitizeUrl(apiBaseUrl),
      hasCookieSecure: typeof cookieSecure === "string",
      cookieSecureValue: cookieSecure ?? null,
      hasCookieDomain: Boolean(cookieDomain && cookieDomain.trim().length > 0),
    },
    { status: 200 },
  );
}
