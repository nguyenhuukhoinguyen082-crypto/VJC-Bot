import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const authRoutes = ["/login", "/register"];
const PANEL_GROUPS = new Set(["dev", "director", "staff"]);

// Cross-origin deploy: auth cookies live on the API host, not Vercel.
// Protected routes rely on client-side guards + sessionStorage token.
const usesExternalApi =
  !!process.env.NEXT_PUBLIC_API_URL?.startsWith("http");

export function middleware(request: NextRequest) {
  const token = request.cookies.get("access_token")?.value;
  const userGroup = request.cookies.get("user_group")?.value;
  const { pathname } = request.nextUrl;

  const isAdmin = pathname.startsWith("/panel");
  const isAuth = authRoutes.some((route) => pathname.startsWith(route));

  if (usesExternalApi) {
    if (isAuth && token) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/booking");

  if ((isProtected || isAdmin) && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdmin && token) {
    if (!userGroup || !PANEL_GROUPS.has(userGroup)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (isAuth && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/booking/:path*", "/panel/:path*", "/login", "/register"],
};
