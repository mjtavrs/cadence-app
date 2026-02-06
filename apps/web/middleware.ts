import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ACCESS_COOKIE = "cadence_access";
const WORKSPACE_COOKIE = "cadence_workspace";

function isProtectedPath(pathname: string) {
  return pathname.startsWith("/app") || pathname.startsWith("/w");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const workspaceId = req.cookies.get(WORKSPACE_COOKIE)?.value;

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

  // `/w` exige sessão, mas não exige workspace selecionado.
  if (pathname.startsWith("/app") && accessToken && !workspaceId) {
    const url = req.nextUrl.clone();
    url.pathname = "/w";
    url.searchParams.set("next", pathname);
    // Quando o usuário caiu aqui por falta de workspace, faz sentido auto-selecionar o "último ativo" (sincronizado)
    // e seguir. Se ele acessar `/w` manualmente, queremos deixar escolher.
    url.searchParams.set("auto", "1");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/w/:path*", "/login"],
};

