import { decode as defaultJwtDecode } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";

/** Edge-safe JWT helpers — no database or Node-only imports. */

export const SESSION_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "__Host-next-auth.session-token",
] as const;

/**
 * NextAuth requires a stable secret. If NEXTAUTH_SECRET is missing, NextAuth hashes the whole
 * config object — that hash changes on hot reload / edits and breaks existing session cookies.
 * In development only, use a fixed fallback when env is unset.
 */
export function resolveNextAuthSecret(): string {
  const fromEnv =
    process.env.NEXTAUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV !== "production") {
    return "local-dev-only-nextauth-secret-not-for-production";
  }
  throw new Error(
    "NEXTAUTH_SECRET or AUTH_SECRET must be set in production. See .env.example."
  );
}

export const nextAuthSecret = resolveNextAuthSecret();

/** Decode JWT without throwing — stale cookies after secret rotation return null. */
export async function safeJwtDecode(
  params: Parameters<typeof defaultJwtDecode>[0]
): Promise<JWT | null> {
  try {
    return (await defaultJwtDecode(params)) as JWT | null;
  } catch {
    return null;
  }
}
