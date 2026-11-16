import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { UserRole } from "@/generated/prisma/client";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

const credentialsProvider = Credentials({
  id: "credentials",
  name: "Email and password",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) {
    const email =
      typeof credentials?.email === "string"
        ? credentials.email.trim().toLowerCase()
        : "";
    const password =
      typeof credentials?.password === "string" ? credentials.password : "";
    if (!email || !password) return null;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) return null;

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [credentialsProvider],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        token.role =
          dbUser?.role ?? (user as { role?: UserRole }).role ?? UserRole.member;
      }
      return token;
    },
  },
});
