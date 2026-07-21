import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { JobStatus, JobType } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveExportPath } from "@/lib/issue-export";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await auth()))
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const job = await prisma.job.findFirst({
    where: { id, type: JobType.export_issues, status: JobStatus.completed },
    select: { export: true },
  });
  if (!job?.export || job.export.filename !== job.export.filePath) {
    return Response.json({ error: "Export not found" }, { status: 404 });
  }

  try {
    const storagePath =
      process.env.STORAGE_PATH ?? resolve(process.cwd(), "data/exports");
    const file = resolveExportPath(storagePath, job.export.filePath);
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const body = await handle.readFile().finally(() => handle.close());
    return new Response(body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${job.export.filename}"`,
        "Content-Length": String(body.byteLength),
        "Content-Type": job.export.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Export file not found" }, { status: 404 });
  }
}
