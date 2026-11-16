"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserRole } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

async function requireAdminId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== UserRole.admin) {
    redirect("/settings?error=forbidden");
  }
  return session.user.id;
}

function passwordFrom(formData: FormData): string {
  return String(formData.get("password") ?? "");
}

export async function createUser(formData: FormData) {
  await requireAdminId();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = passwordFrom(formData);
  const role =
    String(formData.get("role") ?? "member") === "admin"
      ? UserRole.admin
      : UserRole.member;

  if (!EMAIL_PATTERN.test(email)) redirect("/settings?error=email");
  if (name.length > 120) redirect("/settings?error=name");
  if (password.length < MIN_PASSWORD_LENGTH) {
    redirect("/settings?error=password");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) redirect("/settings?error=duplicate");

  await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash: await hashPassword(password),
      role,
    },
  });

  revalidatePath("/settings");
  redirect("/settings?ok=created");
}

export async function resetUserPassword(formData: FormData) {
  await requireAdminId();

  const userId = String(formData.get("userId") ?? "");
  const password = passwordFrom(formData);
  if (!userId) redirect("/settings?error=missing-user");
  if (password.length < MIN_PASSWORD_LENGTH) {
    redirect("/settings?error=password");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/settings?error=missing-user");

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });

  revalidatePath("/settings");
  redirect("/settings?ok=reset");
}

export async function changeOwnPassword(formData: FormData) {
  const userId = await requireUserId();

  const current = String(formData.get("current") ?? "");
  const password = passwordFrom(formData);
  if (!current) redirect("/settings?error=current");
  if (password.length < MIN_PASSWORD_LENGTH) {
    redirect("/settings?error=password");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(current, user.passwordHash))) {
    redirect("/settings?error=current");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });

  redirect("/settings?ok=password");
}
