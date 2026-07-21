import Link from "next/link";
import { redirect } from "next/navigation";
import { JobStatus, JobType } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ExportForm } from "@/app/exports/export-form";

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
        <h1 className="text-2xl font-semibold">Exports</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Export the filtered issue list as CSV or JSON.
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
        <h2 className="mb-3 text-lg font-semibold">Recent exports</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Attempts</th>
                <th className="px-4 py-3 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className="border-t border-zinc-200 dark:border-zinc-800"
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    {job.createdAt.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{job.status.replace("_", " ")}</td>
                  <td className="px-4 py-3">
                    {job.attempts}/{job.maxAttempts}
                  </td>
                  <td className="px-4 py-3">
                    {job.export && job.status === JobStatus.completed ? (
                      <Link
                        href={`/api/exports/${job.id}/download`}
                        className="font-medium underline underline-offset-4"
                      >
                        Download {job.export.filename} ({job.export.issueCount}{" "}
                        issues)
                      </Link>
                    ) : job.error ? (
                      <span className="text-red-700 dark:text-red-400">
                        {job.error}
                      </span>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    No exports yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
