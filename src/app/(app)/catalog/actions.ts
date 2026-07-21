"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateServiceToken, hashServiceToken } from "@/lib/service-token";

type TokenActionState = {
  token: string | null;
  serviceName: string | null;
  error: string | null;
};

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

function text(formData: FormData, key: string, max = 120): string {
  const value = String(formData.get(key) ?? "").trim();
  if (!value || value.length > max) throw new Error(`${key} is required`);
  return value;
}

function optionalText(formData: FormData, key: string, max = 500): string | null {
  const value = String(formData.get(key) ?? "").trim();
  if (value.length > max) throw new Error(`${key} is too long`);
  return value || null;
}

function slug(formData: FormData): string {
  const value = text(formData, "slug", 80).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error("slug must contain lowercase letters, numbers, and single hyphens");
  }
  return value;
}

export async function createApplication(formData: FormData) {
  await requireUser();
  const tools = await prisma.tool.findMany({ select: { id: true } });

  await prisma.application.create({
    data: {
      name: text(formData, "name"),
      slug: slug(formData),
      description: optionalText(formData, "description"),
      qualityGates: { create: { name: "default" } },
      appToolConfigs: {
        create: tools.map(({ id }) => ({ toolId: id, enabled: true })),
      },
    },
  });
  revalidatePath("/catalog");
  revalidatePath("/gates");
}

export async function updateApplication(applicationId: string, formData: FormData) {
  await requireUser();
  await prisma.application.update({
    where: { id: applicationId },
    data: {
      name: text(formData, "name"),
      slug: slug(formData),
      description: optionalText(formData, "description"),
    },
  });
  revalidatePath("/catalog");
  revalidatePath("/gates");
}

export async function deleteApplication(applicationId: string) {
  await requireUser();
  await prisma.application.delete({ where: { id: applicationId } });
  revalidatePath("/catalog");
  revalidatePath("/gates");
}

export async function createService(
  _state: TokenActionState,
  formData: FormData,
): Promise<TokenActionState> {
  await requireUser();

  try {
    const token = generateServiceToken();
    const service = await prisma.service.create({
      data: {
        applicationId: text(formData, "applicationId"),
        name: text(formData, "name"),
        slug: slug(formData),
        tokenHash: hashServiceToken(token),
      },
      select: { name: true },
    });
    revalidatePath("/catalog");
    return { token, serviceName: service.name, error: null };
  } catch {
    return {
      token: null,
      serviceName: null,
      error: "Could not create service. Check that its slug is unique in this application.",
    };
  }
}

export async function updateService(serviceId: string, formData: FormData) {
  await requireUser();
  await prisma.service.update({
    where: { id: serviceId },
    data: { name: text(formData, "name"), slug: slug(formData) },
  });
  revalidatePath("/catalog");
}

export async function deleteService(serviceId: string) {
  await requireUser();
  await prisma.service.delete({ where: { id: serviceId } });
  revalidatePath("/catalog");
}

export async function rotateServiceToken(
  serviceId: string,
  _state: TokenActionState,
  _formData: FormData,
): Promise<TokenActionState> {
  void _state;
  void _formData;
  await requireUser();
  const token = generateServiceToken();
  const service = await prisma.service.update({
    where: { id: serviceId },
    data: { tokenHash: hashServiceToken(token) },
    select: { name: true },
  });
  revalidatePath("/catalog");
  return { token, serviceName: service.name, error: null };
}

export async function revokeServiceToken(serviceId: string) {
  await requireUser();
  await prisma.service.update({
    where: { id: serviceId },
    data: { tokenHash: null },
  });
  revalidatePath("/catalog");
}

export async function updateApplicationTool(
  applicationId: string,
  toolId: string,
  formData: FormData,
) {
  await requireUser();
  const value = text(formData, "enabled");
  if (value !== "true" && value !== "false") throw new Error("Invalid tool setting");
  const enabled = value === "true";
  await prisma.appToolConfig.upsert({
    where: { applicationId_toolId: { applicationId, toolId } },
    create: { applicationId, toolId, enabled },
    update: { enabled },
  });
  revalidatePath("/catalog");
}

export async function updateServiceTool(
  serviceId: string,
  toolId: string,
  formData: FormData,
) {
  await requireUser();
  const value = text(formData, "enabled");
  if (!["inherit", "true", "false"].includes(value)) {
    throw new Error("Invalid tool setting");
  }
  if (value === "inherit") {
    await prisma.serviceToolConfig.deleteMany({ where: { serviceId, toolId } });
  } else {
    const enabled = value === "true";
    await prisma.serviceToolConfig.upsert({
      where: { serviceId_toolId: { serviceId, toolId } },
      create: { serviceId, toolId, enabled },
      update: { enabled },
    });
  }
  revalidatePath("/catalog");
}
