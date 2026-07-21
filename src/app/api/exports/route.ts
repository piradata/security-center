import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseIssueExportPayload } from "@/lib/issue-export";
import { JobType, type Prisma } from "@/generated/prisma/client";

export async function GET() {
  if (!(await auth())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await prisma.job.findMany({
    where: { type: JobType.export_issues },
    include: { export: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return Response.json(jobs);
}

export async function POST(request: Request) {
  if (!(await auth())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const payload = parseIssueExportPayload(await request.json());
    const job = await prisma.job.create({
      data: {
        type: JobType.export_issues,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
      select: { id: true, status: true, createdAt: true },
    });
    return Response.json(job, { status: 202 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}
