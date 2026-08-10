import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic route protection.
 *
 * This checks only for the PRESENCE of a session cookie — it is a redirect
 * convenience, not a security boundary. Middleware runs on the edge and cannot
 * reach the database, so it cannot verify the session, the user's status, or
 * any permission.
 *
 * Real enforcement happens server-side in requireAuth/requirePermission on
 * every page and action (docs/SECURITY.md §3). A forged cookie gets past this
 * file and is rejected immediately afterwards.
 */

const PUBLIC_ROUTES = ["/login", "/forgot-password"];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = getSessionCookie(request, { cookiePrefix: "oms" }) !== null;
  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  if (!hasSessionCookie && !isPublic) {
    const url = new URL("/login", request.url);
    // Relative path only — never an absolute URL, which would be an open
    // redirect. Validated again on the login side before use.
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (hasSessionCookie && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next internals, the auth endpoints, and static assets.
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
