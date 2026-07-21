import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
            name: true,
            application: { select: { name: true } },
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

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/issues" className="text-sm text-zinc-500 hover:underline">
        ← Back to issues
      </Link>
      <div className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight">{issue.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {issue.service.application.name} / {issue.service.name} ·{" "}
          {issue.tool.name}
        </p>
      </div>

      <section className="mt-6 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Triage</h2>
        <div className="mt-4">
          <IssueControls
            issueId={issue.id}
            initialStatus={issue.status}
            initialAssigneeUserId={issue.assigneeUserId}
            users={users}
          />
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Details</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <Detail label="Severity" value={issue.severity} />
          <Detail label="Status" value={issue.status.replaceAll("_", " ")} />
          <Detail label="Fingerprint" value={issue.fingerprint} />
          <Detail
            label="Assignee"
            value={
              issue.assignee?.name ?? issue.assignee?.email ?? "Unassigned"
            }
          />
          <Detail
            label="First seen"
            value={issue.firstSeenAt.toLocaleString()}
          />
          <Detail label="Last seen" value={issue.lastSeenAt.toLocaleString()} />
          {issue.regressionAt && (
            <Detail
              label="Last regression"
              value={issue.regressionAt.toLocaleString()}
            />
          )}
        </dl>
        {issue.description && (
          <p className="mt-5 whitespace-pre-wrap text-sm">
            {issue.description}
          </p>
        )}
        {issue.raw !== null && (
          <details className="mt-5">
            <summary className="cursor-pointer text-sm font-medium">
              Raw finding
            </summary>
            <pre className="mt-2 overflow-auto rounded-md bg-zinc-100 p-3 text-xs dark:bg-zinc-900">
              {JSON.stringify(issue.raw, null, 2)}
            </pre>
          </details>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="mt-0.5 break-all font-medium capitalize">{value}</dd>
    </div>
  );
}
