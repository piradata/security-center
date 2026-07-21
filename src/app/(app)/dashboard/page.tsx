import Link from "next/link";
import { redirect } from "next/navigation";
import { IssueSeverity, IssueStatus } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { applicationScore, serviceScore } from "@/lib/scoring";

const ACTIVE = [IssueStatus.open, IssueStatus.in_progress];
const GATE_SEVERITIES = [IssueSeverity.critical, IssueSeverity.high];

export default async function DashboardPage() {
  if (!(await auth())?.user) redirect("/login");

  const [counts, applications, regressions, newIssues] = await Promise.all([
    prisma.issue.groupBy({
      by: ["severity"],
      where: { status: { in: ACTIVE } },
      _count: true,
    }),
    prisma.application.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        services: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            issues: {
              where: { status: { in: ACTIVE } },
              select: { severity: true, status: true },
            },
          },
        },
      },
    }),
    prisma.issue.findMany({
      where: {
        status: { in: ACTIVE },
        severity: { in: GATE_SEVERITIES },
        regressionAt: { not: null },
      },
      orderBy: { regressionAt: "desc" },
      take: 10,
      include: {
        service: {
          select: {
            name: true,
            application: { select: { name: true } },
          },
        },
      },
    }),
    prisma.issue.findMany({
      where: {
        status: { in: ACTIVE },
        severity: { in: GATE_SEVERITIES },
        regressionAt: null,
      },
      orderBy: { firstSeenAt: "desc" },
      take: 10,
      include: {
        service: {
          select: {
            name: true,
            application: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const countBySeverity = new Map(
    counts.map(({ severity, _count }) => [severity, _count]),
  );
  const scores = applications.map((application) => {
    const services = application.services.map((service) => ({
      ...service,
      score: serviceScore(service.issues),
    }));
    return {
      ...application,
      services,
      score: applicationScore(services.map(({ score }) => score)),
    };
  });
  const recent = [
    ...regressions.map((issue) => ({
      ...issue,
      event: "Regression",
      eventAt: issue.regressionAt!,
    })),
    ...newIssues.map((issue) => ({
      ...issue,
      event: "New",
      eventAt: issue.firstSeenAt,
    })),
  ]
    .sort((a, b) => b.eventAt.getTime() - a.eventAt.getTime())
    .slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Active issue exposure and gate-relevant changes.
      </p>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Open issues by severity</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Object.values(IssueSeverity).map((severity) => (
            <div
              key={severity}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <p className="text-sm capitalize text-zinc-500">{severity}</p>
              <p className="mt-1 text-3xl font-semibold">
                {countBySeverity.get(severity) ?? 0}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Application and service scores</h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {scores.map((application) => (
            <article
              key={application.id}
              className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{application.name}</h3>
                <Score value={application.score} />
              </div>
              <ul className="mt-4 space-y-2">
                {application.services.map((service) => (
                  <li
                    key={service.id}
                    className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900"
                  >
                    <span>{service.name}</span>
                    <Score value={service.score} />
                  </li>
                ))}
                {!application.services.length && (
                  <li className="text-sm text-zinc-500">No services.</li>
                )}
              </ul>
            </article>
          ))}
          {!scores.length && (
            <p className="text-sm text-zinc-500">No applications yet.</p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">
          Recent High/Critical changes
        </h2>
        <div className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {recent.map((issue) => (
            <Link
              key={issue.id}
              href={`/issues/${issue.id}`}
              className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span>
                <span className="font-medium">{issue.title}</span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  {issue.service.application.name} / {issue.service.name}
                </span>
              </span>
              <span className="text-right text-xs">
                <span className="font-medium">
                  {issue.event} · {issue.severity}
                </span>
                <span className="mt-0.5 block text-zinc-500">
                  {issue.eventAt.toLocaleString()}
                </span>
              </span>
            </Link>
          ))}
          {!recent.length && (
            <p className="p-6 text-center text-sm text-zinc-500">
              No active High/Critical changes.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Score({ value }: { value: number }) {
  return (
    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold tabular-nums dark:bg-zinc-800">
      {value}
    </span>
  );
}
