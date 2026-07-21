import { createHash, randomBytes } from "node:crypto";

const TOKEN_PREFIX = "sc_";

export function generateServiceToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashServiceToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function bearerToken(authorization: string | null): string | null {
  const match = authorization?.match(/^Bearer (sc_[A-Za-z0-9_-]{43})$/i);
  return match?.[1] ?? null;
}

export async function authenticateServiceBearer(authorization: string | null) {
  const token = bearerToken(authorization);
  if (!token) return null;

  const { prisma } = await import("@/lib/db");
  return prisma.service.findUnique({
    where: { tokenHash: hashServiceToken(token) },
    select: {
      id: true,
      name: true,
      slug: true,
      applicationId: true,
      application: { select: { id: true, name: true, slug: true } },
    },
  });
}
