import { Download } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ExportForm } from "@/app/exports/export-form";
import { Badge } from "@/components/ui/badge";
import { JobStatus, JobType } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function ExportsPage() {
  if (!(await auth())) redirect("/login");

  const [jobs, applications, services, tools, users] = await Promise.all([
    prisma.job.findMany({
      where: { type: JobType.export_issues },
      include: { export: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.application.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.service.findMany({
      select: {
        id: true,
        name: true,
        application: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.tool.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { email: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto grid max-w-6xl gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          Exports
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Generate and download security posture reports in CSV or JSON format.
        </p>
      </div>

      <ExportForm
        applications={applications}
        services={services}
        tools={tools}
        users={users.map((user) => ({ ...user, name: user.name ?? "" }))}
        hasActiveJobs={jobs.some(
          (job) =>
            job.status === JobStatus.pending ||
            job.status === JobStatus.running,
        )}
      />

      <section>
        <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100 sm:text-lg">
          Recent Exports
        </h2>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-hidden rounded-xl border border-zinc-200 bg-card dark:border-zinc-800 shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50/70 text-xs font-semibold text-zinc-500 uppercase tracking-wider dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3.5">Created</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Attempts</th>
                <th className="px-4 py-3.5">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/30 transition-colors"
                >
                  <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {job.createdAt.toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5">
                    <JobStatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3.5 text-xs text-zinc-500 font-mono">
                    {job.attempts}/{job.maxAttempts}
                  </td>
                  <td className="px-4 py-3.5">
                    {job.export && job.status === JobStatus.completed ? (
                      <Link
                        href={`/api/exports/${job.id}/download`}
                        className="inline-flex items-center gap-1.5 font-semibold text-xs text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        <Download className="h-3.5 w-3.5 text-zinc-500" />
                        <span>
                          Download {job.export.filename} (
                          {job.export.issueCount} issues)
                        </span>
                      </Link>
                    ) : job.error ? (
                      <span className="text-xs text-red-600 dark:text-red-400">
                        {job.error}
                      </span>
                    ) : (
                      <span className="text-zinc-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-xs text-zinc-500"
                  >
                    No exports requested yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View (< sm) */}
        <div className="sm:hidden space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-xl border border-zinc-200 bg-card p-4 dark:border-zinc-800 space-y-2.5 shadow-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <JobStatusBadge status={job.status} />
                <span className="text-[11px] font-mono text-zinc-400">
                  {job.createdAt.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {job.export && job.status === JobStatus.completed ? (
                <div className="pt-1">
                  <Link
                    href={`/api/exports/${job.id}/download`}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>
                      Download {job.export.filename} ({job.export.issueCount}{" "}
                      findings)
                    </span>
                  </Link>
                </div>
              ) : job.error ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {job.error}
                </p>
              ) : (
                <p className="text-xs text-zinc-400">Processing job...</p>
              )}
            </div>
          ))}

          {jobs.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-xs text-zinc-500 dark:border-zinc-700">
              No exports requested yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function JobStatusBadge({ status }: { status: JobStatus }) {
  if (status === JobStatus.completed) {
    return (
      <Badge variant="success" dot>
        Completed
      </Badge>
    );
  }
  if (status === JobStatus.running) {
    return (
      <Badge variant="info" dot>
        Running
      </Badge>
    );
  }
  if (status === JobStatus.failed) {
    return (
      <Badge variant="danger" dot>
        Failed
      </Badge>
    );
  }
  return (
    <Badge variant="warning" dot>
      Pending
    </Badge>
  );
}
