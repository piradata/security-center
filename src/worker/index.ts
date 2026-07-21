import { randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import {
  ExportFormat,
  JobStatus,
  type Prisma,
  PrismaClient,
} from "@/generated/prisma/client";
import {
  exportFilename,
  parseIssueExportPayload,
  resolveExportPath,
  retryStatus,
  serializeIssueExport,
} from "@/lib/issue-export";

loadEnv({ path: resolve(process.cwd(), ".env") });

const POLL_MS = Math.max(100, Number(process.env.WORKER_POLL_MS) || 5000);
const STORAGE_PATH =
  process.env.STORAGE_PATH ?? resolve(process.cwd(), "data/exports");

type ClaimedJob = {
  id: string;
  payload: Prisma.JsonValue | null;
  attempts: number;
  maxAttempts: number;
};

function createPrisma() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
}

async function claimExportJob(
  prisma: PrismaClient,
): Promise<ClaimedJob | null> {
  const jobs = await prisma.$queryRaw<ClaimedJob[]>`
    WITH next_job AS (
      SELECT id
      FROM "Job"
      WHERE status = 'pending'::"JobStatus"
        AND type = 'export_issues'::"JobType"
        AND "availableAt" <= NOW()
      ORDER BY "createdAt"
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "Job" AS job
    SET status = 'running'::"JobStatus",
        "startedAt" = NOW(),
        "completedAt" = NULL,
        error = NULL,
        attempts = job.attempts + 1
    FROM next_job
    WHERE job.id = next_job.id
    RETURNING job.id, job.payload, job.attempts, job."maxAttempts"
  `;
  return jobs[0] ?? null;
}

async function writeAtomically(filePath: string, contents: string) {
  await mkdir(dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, contents, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporary, filePath);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

async function completeExport(prisma: PrismaClient, job: ClaimedJob) {
  const payload = parseIssueExportPayload(job.payload);
  const where: Prisma.IssueWhereInput = {};
  if (payload.filters.appId) {
    where.service = { applicationId: payload.filters.appId };
  }
  if (payload.filters.serviceId) where.serviceId = payload.filters.serviceId;
  if (payload.filters.toolId) where.toolId = payload.filters.toolId;
  if (payload.filters.severity) where.severity = payload.filters.severity;
  if (payload.filters.status) where.status = payload.filters.status;
  if (payload.filters.unassigned) {
    where.assigneeUserId = null;
  } else if (payload.filters.assigneeUserId) {
    where.assigneeUserId = payload.filters.assigneeUserId;
  }

  const issues = await prisma.issue.findMany({
    where,
    orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      severity: true,
      status: true,
      title: true,
      description: true,
      fingerprint: true,
      firstSeenAt: true,
      lastSeenAt: true,
      service: {
        select: { name: true, application: { select: { name: true } } },
      },
      tool: { select: { name: true } },
      assignee: { select: { name: true, email: true } },
    },
  });
  const contents = serializeIssueExport(
    payload.format,
    issues.map((issue) => ({
      id: issue.id,
      application: issue.service.application.name,
      service: issue.service.name,
      tool: issue.tool.name,
      severity: issue.severity,
      status: issue.status,
      assignee: issue.assignee?.name ?? issue.assignee?.email ?? "",
      title: issue.title,
      description: issue.description ?? "",
      fingerprint: issue.fingerprint,
      firstSeenAt: issue.firstSeenAt,
      lastSeenAt: issue.lastSeenAt,
    })),
  );
  const filename = exportFilename(job.id, payload.format);
  const filePath = resolveExportPath(STORAGE_PATH, filename);
  const contentType =
    payload.format === ExportFormat.csv
      ? "text/csv; charset=utf-8"
      : "application/json; charset=utf-8";

  await writeAtomically(filePath, contents);
  await prisma.$transaction([
    prisma.export.upsert({
      where: { jobId: job.id },
      create: {
        jobId: job.id,
        format: payload.format,
        filePath: filename,
        filename,
        contentType,
        byteSize: Buffer.byteLength(contents),
        issueCount: issues.length,
      },
      update: {
        format: payload.format,
        filePath: filename,
        filename,
        contentType,
        byteSize: Buffer.byteLength(contents),
        issueCount: issues.length,
      },
    }),
    prisma.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.completed,
        completedAt: new Date(),
        error: null,
      },
    }),
  ]);
}

async function failJob(prisma: PrismaClient, job: ClaimedJob, error: unknown) {
  const status = retryStatus(job.attempts, job.maxAttempts);
  const retryDelayMs = Math.min(60, 2 ** Math.max(0, job.attempts - 1)) * 1000;
  await prisma.job.updateMany({
    where: { id: job.id, status: JobStatus.running, attempts: job.attempts },
    data: {
      status,
      error: String(error instanceof Error ? error.message : error).slice(
        0,
        4000,
      ),
      startedAt: status === JobStatus.pending ? null : undefined,
      completedAt: status === JobStatus.failed ? new Date() : null,
      availableAt:
        status === JobStatus.pending
          ? new Date(Date.now() + retryDelayMs)
          : undefined,
    },
  });
}

async function tick(prisma: PrismaClient) {
  const job = await claimExportJob(prisma);
  if (!job) {
    await prisma.$queryRaw`SELECT 1`;
    return false;
  }
  try {
    await completeExport(prisma, job);
    console.log(`[worker] completed export job ${job.id}`);
  } catch (error) {
    await failJob(prisma, job, error);
    console.error(`[worker] failed export job ${job.id}`, error);
  }
  return true;
}

function wait(ms: number, signal: AbortSignal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>((done) => {
    const timeout = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
    function finish() {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      done();
    }
  });
}

async function main() {
  const prisma = createPrisma();
  const shutdown = new AbortController();
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      console.log(`[worker] ${signal} received, shutting down`);
      shutdown.abort();
    });
  }

  console.log("[worker] started (export jobs only)");
  try {
    while (!shutdown.signal.aborted) {
      try {
        if (!(await tick(prisma))) await wait(POLL_MS, shutdown.signal);
      } catch (error) {
        console.error("[worker] tick failed", error);
        await wait(POLL_MS, shutdown.signal);
      }
    }
  } finally {
    await prisma.$disconnect();
    console.log("[worker] stopped");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
