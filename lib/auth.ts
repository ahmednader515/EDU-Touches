import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { randomUUID } from "crypto";
import { getUserByEmailOrPhone, getCurrentSessionId, setCurrentSessionId } from "@/lib/db";
import type { UserRole } from "@/lib/types";
import { CONCURRENT_SESSION_ERROR } from "@/lib/auth-constants";
import { nextAuthSecret, safeJwtDecode } from "@/lib/auth-jwt";

export { CONCURRENT_SESSION_ERROR };
export { SESSION_COOKIE_NAMES, nextAuthSecret, resolveNextAuthSecret, safeJwtDecode } from "@/lib/auth-jwt";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "البريد الإلكتروني أو رقم الهاتف", type: "text" },
        password: { label: "كلمة المرور", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await getUserByEmailOrPhone(credentials.email);
        if (!user) return null;
        const ok = await compare(credentials.password, user.password_hash);
        if (!ok) return null;
        const existingSessionId = await getCurrentSessionId(user.id);
        if (existingSessionId != null && existingSessionId !== "") {
          throw new Error(CONCURRENT_SESSION_ERROR);
        }
        const sessionId = randomUUID();
        await setCurrentSessionId(user.id, sessionId);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: null,
          sessionId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: UserRole }).role;
        token.sessionId = (user as { sessionId?: string }).sessionId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: UserRole }).role = token.role as UserRole;
        const { getCurrentSessionId: getSessionId } = await import("@/lib/db");
        const dbSessionId = await getSessionId((session.user as { id: string }).id);
        const sessionMismatch = !dbSessionId || dbSessionId.trim() === "" || dbSessionId !== token.sessionId;
        if (token.sessionId && sessionMismatch) {
          (session as { forceLogout?: boolean }).forceLogout = true;
        }
      }
      return session;
    },
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/dashboard`;
    },
  },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: nextAuthSecret,
  logger: {
    error(code, metadata) {
      if (code === "JWT_SESSION_ERROR") return;
      console.error(`[next-auth][error][${code}]`, metadata);
    },
  },
  jwt: {
    async decode(params) {
      return safeJwtDecode(params);
    },
  },
};
