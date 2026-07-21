"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireUser() {
  if (!(await auth())?.user) throw new Error("Unauthorized");
}

function gateData(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 80) throw new Error("Gate name is required");

  const rawThreshold = String(formData.get("scoreThreshold") ?? "").trim();
  const scoreThreshold = rawThreshold === "" ? null : Number(rawThreshold);
  if (
    scoreThreshold !== null &&
    (!Number.isInteger(scoreThreshold) || scoreThreshold < 0 || scoreThreshold > 100)
  ) {
    throw new Error("Score threshold must be a whole number from 0 to 100");
  }

  return {
    name,
    scoreThreshold,
    failOnNewHighCritical: formData.get("failOnNewHighCritical") === "on",
  };
}

export async function createQualityGate(formData: FormData) {
  await requireUser();
  const applicationId = String(formData.get("applicationId") ?? "").trim();
  if (!applicationId) throw new Error("Application is required");
  await prisma.qualityGate.create({
    data: {
      applicationId,
      ...gateData(formData),
    },
  });
  revalidatePath("/gates");
}

export async function updateQualityGate(gateId: string, formData: FormData) {
  await requireUser();
  await prisma.qualityGate.update({
    where: { id: gateId },
    data: gateData(formData),
  });
  revalidatePath("/gates");
}

export async function deleteQualityGate(gateId: string) {
  await requireUser();
  await prisma.qualityGate.delete({ where: { id: gateId } });
  revalidatePath("/gates");
}
