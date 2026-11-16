import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";

/**
 * Lockout recovery. Resets an existing account's password.
 *
 *   pnpm auth:password <email> [new-password] [--admin]
 *
 * Prefer passing the password through NEW_PASSWORD so it does not land in
 * shell history:
 *
 *   NEW_PASSWORD='...' pnpm auth:password admin@example.com --admin
 */
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const args = process.argv.slice(2);
  const email = args[0]?.trim().toLowerCase();
  const makeAdmin = args.includes("--admin");
  const positionalPassword =
    args[1] && !args[1].startsWith("--") ? args[1] : "";
  const password = positionalPassword || process.env.NEW_PASSWORD || "";

  if (!email) {
    console.error("Usage: pnpm auth:password <email> [new-password] [--admin]");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error(
      "Provide a password of at least 8 characters via NEW_PASSWORD or the second argument.",
    );
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user with email ${email}.`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      ...(makeAdmin ? { role: UserRole.admin } : {}),
    },
  });

  console.log(
    `Updated password for ${email}${makeAdmin ? " (role: admin)" : ""}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
