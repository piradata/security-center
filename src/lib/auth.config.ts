import type { NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Edge-safe Auth.js config. It has no providers because credential
 * verification needs Prisma/scrypt and lives in `auth.ts`.
 */
export const authConfig = {
  providers: [] as Provider[],
  pages: { signIn: "/login" },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  trustHost: true,
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (
        pathname.startsWith("/api/") ||
        pathname === "/login" ||
        pathname === "/setup"
      ) {
        return true;
      }
      return !!auth?.user;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = ((user as { role?: UserRole }).role ??
          "member") as UserRole;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = (token.role as UserRole) ?? "member";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
