import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ACCESS_COOKIE = "cadence_access";

function isProtectedPath(pathname: string) {
  return pathname.startsWith("/app") || pathname.startsWith("/w");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;

  if (pathname === "/login" && accessToken) {
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  if (isProtectedPath(pathname) && !accessToken) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/w/:path*", "/login"],
};

