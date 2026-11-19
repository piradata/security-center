import { AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { IssueControls } from "./issue-controls";

export default async function IssuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await auth())?.user) redirect("/login");

  const { id } = await params;
  const [issue, users] = await Promise.all([
    prisma.issue.findUnique({
      where: { id },
      include: {
        assignee: { select: { name: true, email: true } },
        tool: { select: { name: true } },
        service: {
          select: {
            id: true,
            name: true,
            application: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      orderBy: { email: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);
  if (!issue) notFound();

  const rawJsonString = issue.raw ? JSON.stringify(issue.raw, null, 2) : "";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/issues"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to all findings
        </Link>
      </div>

      {/* Header Banner */}
      <div className="rounded-xl border border-zinc-200 bg-card p-5 sm:p-6 dark:border-zinc-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={issue.severity} dot>
            <span className="capitalize font-semibold">{issue.severity}</span>
          </Badge>
          <Badge variant={issue.status}>
            <span className="capitalize">
              {issue.status.replaceAll("_", " ")}
            </span>
          </Badge>
          <span className="rounded-md bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {issue.tool.name}
          </span>
          {issue.regressionAt && (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              Reopened Regression
            </span>
          )}
        </div>

        <h1 className="mt-3 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl break-words">
          {issue.title}
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <Link
            href={`/catalog`}
            className="hover:underline font-medium text-zinc-700 dark:text-zinc-300"
          >
            {issue.service.application.name}
          </Link>
          <span>/</span>
          <Link
            href={`/issues?serviceId=${issue.service.id}`}
            className="hover:underline font-medium text-zinc-700 dark:text-zinc-300"
          >
            {issue.service.name}
          </Link>
        </div>
      </div>

      {/* Triage Section */}
      <section className="rounded-xl border border-zinc-200 bg-card p-5 sm:p-6 dark:border-zinc-800 shadow-xs">
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          Triage & Assignment
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Update the resolution state or assign this security finding to a team
          member.
        </p>
        <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <IssueControls
            issueId={issue.id}
            initialStatus={issue.status}
            initialAssigneeUserId={issue.assigneeUserId}
            users={users}
          />
        </div>
      </section>

      {/* Finding Details */}
      <section className="rounded-xl border border-zinc-200 bg-card p-5 sm:p-6 dark:border-zinc-800 shadow-xs">
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          Finding Metadata
        </h2>

        <div className="mt-4 divide-y divide-zinc-100 rounded-lg border border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
          {/* Fingerprint row with copy button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 sm:px-4">
            <span className="text-xs font-medium text-zinc-500">
              Fingerprint Identity
            </span>
            <div className="flex items-center gap-2 max-w-full overflow-hidden">
              <code className="truncate rounded bg-zinc-100 px-2 py-1 font-mono text-xs dark:bg-zinc-800">
                {issue.fingerprint}
              </code>
              <CopyButton text={issue.fingerprint} variant="icon" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-3 sm:px-4">
            <span className="text-xs font-medium text-zinc-500">
              First Detected
            </span>
            <span className="text-xs font-mono text-zinc-800 dark:text-zinc-200">
              {issue.firstSeenAt.toLocaleString()}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-3 sm:px-4">
            <span className="text-xs font-medium text-zinc-500">Last Seen</span>
            <span className="text-xs font-mono text-zinc-800 dark:text-zinc-200">
              {issue.lastSeenAt.toLocaleString()}
            </span>
          </div>

          {issue.regressionAt && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-3 sm:px-4 bg-red-50/50 dark:bg-red-950/20">
              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                Regression Detected
              </span>
              <span className="text-xs font-mono text-red-700 dark:text-red-300">
                {issue.regressionAt.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {issue.description && (
          <div className="mt-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Vulnerability Description
            </h3>
            <div className="mt-2 rounded-lg bg-zinc-50 p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
              {issue.description}
            </div>
          </div>
        )}

        {rawJsonString && (
          <details className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <summary className="cursor-pointer text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
              <span>View Scanner Raw Finding Payload</span>
              <CopyButton text={rawJsonString} label="Copy JSON" />
            </summary>
            <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-zinc-950 p-3.5 font-mono text-[11px] text-zinc-200">
              {rawJsonString}
            </pre>
          </details>
        )}
      </section>
    </div>
  );
}
