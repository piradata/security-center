import type { NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import type { UserRole } from "@/generated/prisma/enums";

function oidcProvider(): Provider | null {
  const issuer = process.env.AUTH_OIDC_ISSUER;
  const clientId = process.env.AUTH_OIDC_CLIENT_ID;
  const clientSecret = process.env.AUTH_OIDC_CLIENT_SECRET;
  if (!issuer || !clientId || !clientSecret) return null;

  return {
    id: "oidc",
    name: "OIDC",
    type: "oidc",
    issuer,
    clientId,
    clientSecret,
    allowDangerousEmailAccountLinking: true,
  };
}

const providers: Provider[] = [];
const oidc = oidcProvider();
if (oidc) providers.push(oidc);

/** Edge-safe Auth.js config (no Prisma) — used by middleware. */
export const authConfig = {
  providers,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/api/auth") || pathname === "/login") return true;
      if (pathname.startsWith("/api/")) return true;
      return !!auth?.user;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = ((user as { role?: UserRole }).role ?? "member") as UserRole;
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
