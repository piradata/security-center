import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { JobType } from "@/generated/prisma/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await auth())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const job = await prisma.job.findFirst({
    where: { id, type: JobType.export_issues },
    include: { export: true },
  });
  return job
    ? Response.json(job)
    : Response.json({ error: "Export job not found" }, { status: 404 });
}
