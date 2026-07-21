import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import { UserRole } from "@/generated/prisma/client";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/db";

function bootstrapAdminEmail(): string | undefined {
  return process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  events: {
    async createUser({ user }) {
      const email = user.email?.toLowerCase();
      const bootstrap = bootstrapAdminEmail();
      if (email && bootstrap && email === bootstrap) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: UserRole.admin },
        });
      }
    },
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      const bootstrap = bootstrapAdminEmail();
      if (!email || !bootstrap || email !== bootstrap || !user.id) return;
      await prisma.user.updateMany({
        where: { id: user.id, role: { not: UserRole.admin } },
        data: { role: UserRole.admin },
      });
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, email: true },
        });
        const email = (dbUser?.email ?? user.email)?.toLowerCase();
        const bootstrap = bootstrapAdminEmail();
        let role = dbUser?.role ?? UserRole.member;
        if (
          email &&
          bootstrap &&
          email === bootstrap &&
          role !== UserRole.admin
        ) {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: UserRole.admin },
          });
          role = UserRole.admin;
        }
        token.role = role;
      }
      return token;
    },
  },
});
