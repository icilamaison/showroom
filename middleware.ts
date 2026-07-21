import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ADMIN_TOKEN_COOKIE = "admin_token";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  if (
    pathname === "/" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/contract")
  ) {
    const token = request.cookies.get(ADMIN_TOKEN_COOKIE)?.value;

    if (!token) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*", "/contract/:path*"],
};
