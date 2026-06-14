import { getToken } from "next-auth/jwt";
import { cookies, headers } from "next/headers";
import type { Session } from "next-auth";
import { authOptions, nextAuthSecret, safeJwtDecode } from "@/lib/auth";

/**
 * Server session for App Router — uses getToken instead of getServerSession so invalid /
 * stale JWT cookies return null without JWT_SESSION_ERROR noise (getServerSession cannot
 * clear cookies in RSC because its response setCookie is a no-op).
 */
export async function getAppServerSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const token = await getToken({
    req: {
      cookies: Object.fromEntries(cookieStore.getAll().map((c) => [c.name, c.value])),
      headers: Object.fromEntries(headerStore.entries()),
    } as Parameters<typeof getToken>[0]["req"],
    secret: nextAuthSecret,
    decode: safeJwtDecode,
  });

  if (!token) return null;

  const sessionCallback = authOptions.callbacks?.session;
  if (!sessionCallback) return null;

  const expires =
    typeof token.exp === "number"
      ? new Date(token.exp * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  return sessionCallback({
    session: {
      user: {
        name: (token.name as string | null | undefined) ?? undefined,
        email: (token.email as string | null | undefined) ?? undefined,
        image: (token.picture as string | null | undefined) ?? undefined,
      },
      expires,
    },
    token,
  } as Parameters<typeof sessionCallback>[0]) as Promise<Session>;
}
