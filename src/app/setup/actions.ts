"use server";

import { redirect } from "next/navigation";
import { UserRole } from "@/generated/prisma/client";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export async function setupAdmin(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!EMAIL_PATTERN.test(email)) redirect("/setup?error=email");
  if (name.length > 120) redirect("/setup?error=name");
  if (password.length < MIN_PASSWORD_LENGTH) redirect("/setup?error=password");
  if (password !== confirm) redirect("/setup?error=match");

  const passwordHash = await hashPassword(password);

  try {
    await prisma.$transaction(async (tx) => {
      // Only one request may claim the initial admin, even if two setup
      // requests arrive at the same time.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('security-center-setup'))`;

      const userCount = await tx.user.count();
      if (userCount > 0) throw new Error("already-initialized");

      await tx.user.create({
        data: {
          email,
          name: name || null,
          passwordHash,
          role: UserRole.admin,
        },
      });
    });
  } catch {
    redirect("/setup?error=exists");
  }

  const result = await signIn("credentials", {
    email,
    password,
    redirect: false,
  });

  const url = typeof result === "string" ? result : "";
  if (!url || /[?&]error=/.test(url)) {
    redirect("/login?error=invalid");
  }

  redirect("/dashboard");
}
