import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { nextAuthSecret, safeJwtDecode, SESSION_COOKIE_NAMES } from "@/lib/auth-jwt";

/** Remove stale session cookies when the JWT cannot be decoded (e.g. after secret change). */
export async function purgeInvalidSessionCookies(
  req: NextRequest,
  response: NextResponse
): Promise<NextResponse> {
  const hasSessionCookie = SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name));
  if (!hasSessionCookie) return response;

  const token = await getToken({
    req,
    secret: nextAuthSecret,
    decode: safeJwtDecode,
  });
  if (token) return response;

  for (const name of SESSION_COOKIE_NAMES) {
    if (req.cookies.has(name)) {
      response.cookies.delete(name);
    }
  }
  return response;
}

export function applyDashboardRoleChecks(req: NextRequest, role: string): NextResponse | null {
  const path = req.nextUrl.pathname;

  if (path.startsWith("/dashboard/teachers")) {
    if (role === "ADMIN") return null;
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (path.startsWith("/dashboard/subscription-students")) {
    if (role === "ADMIN") return null;
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (path.startsWith("/dashboard/students")) {
    if (role === "ADMIN" || role === "ASSISTANT_ADMIN") return null;
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (path.startsWith("/dashboard/courses/new")) {
    if (role === "ADMIN" || role === "ASSISTANT_ADMIN" || role === "TEACHER") return null;
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (
    role === "TEACHER" &&
    (path.startsWith("/dashboard/settings/homepage") ||
      path.startsWith("/dashboard/reviews") ||
      path.startsWith("/dashboard/password-change-requests"))
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return null;
}
