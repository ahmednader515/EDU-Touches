import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { nextAuthSecret, safeJwtDecode } from "@/lib/auth-jwt";
import { applyDashboardRoleChecks, purgeInvalidSessionCookies } from "@/lib/middleware-auth";

export async function middleware(req: NextRequest) {
  let response = NextResponse.next();
  response = await purgeInvalidSessionCookies(req, response);

  if (!req.nextUrl.pathname.startsWith("/dashboard")) {
    return response;
  }

  const token = await getToken({
    req,
    secret: nextAuthSecret,
    decode: safeJwtDecode,
  });

  if (!token) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    const redirect = NextResponse.redirect(login);
    return purgeInvalidSessionCookies(req, redirect);
  }

  const role = token.role as string | undefined;
  if (!role) {
    return response;
  }

  const roleRedirect = applyDashboardRoleChecks(req, role);
  if (roleRedirect) {
    return purgeInvalidSessionCookies(req, roleRedirect);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
