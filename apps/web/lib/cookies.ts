type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  domain?: string;
  maxAgeSeconds?: number;
};

function encodeCookieValue(value: string) {
  return encodeURIComponent(value);
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}) {
  const parts: string[] = [];
  parts.push(`${name}=${encodeCookieValue(value)}`);

  if (options.maxAgeSeconds != null) parts.push(`Max-Age=${options.maxAgeSeconds}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  parts.push(`Path=${options.path ?? "/"}`);

  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");

  if (options.sameSite) {
    const s = options.sameSite[0].toUpperCase() + options.sameSite.slice(1);
    parts.push(`SameSite=${s}`);
  }

  return parts.join("; ");
}

