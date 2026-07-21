import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const V1_TOOLS = [
  {
    key: "gitleaks",
    name: "Gitleaks",
    description: "Secret scanning",
  },
  {
    key: "npm-audit",
    name: "npm audit",
    description: "SCA for Node.js / npm lockfiles",
  },
  {
    key: "pip-audit",
    name: "pip-audit",
    description: "SCA for Python dependencies",
  },
  {
    key: "trivy",
    name: "Trivy",
    description: "Filesystem vulnerability scanning",
  },
  {
    key: "semgrep",
    name: "Semgrep",
    description: "SAST / pattern-based static analysis",
  },
] as const;

async function main() {
  for (const tool of V1_TOOLS) {
    await prisma.tool.upsert({
      where: { key: tool.key },
      create: tool,
      update: {
        name: tool.name,
        description: tool.description,
      },
    });
  }
  console.log(`Seeded ${V1_TOOLS.length} V1 tools`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
