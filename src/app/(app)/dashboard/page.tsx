import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ExternalLink,
  Flame,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CoverageBar } from "@/components/coverage-bar";
import { ScoreBar } from "@/components/score-bar";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { IssueSeverity, IssueStatus } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SCORE_WEIGHTS, scoreLabel, scoreTone } from "@/lib/score-display";
import { applicationScore, serviceScore } from "@/lib/scoring";

const ACTIVE = [IssueStatus.open, IssueStatus.in_progress];
const GATE_SEVERITIES = [IssueSeverity.critical, IssueSeverity.high];

export default async function DashboardPage() {
  if (!(await auth())?.user) redirect("/login");

  const [counts, applications, regressions, newIssues, qualityGates] =
    await Promise.all([
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
          slug: true,
          services: {
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              slug: true,
              issues: {
                where: { status: { in: ACTIVE } },
                select: { severity: true, status: true },
              },
              scans: {
                where: { coverageLine: { not: null } },
                orderBy: { startedAt: "desc" },
                take: 1,
                select: {
                  coverageLine: true,
                  coverageBranch: true,
                  coverageFunction: true,
                  coverageSource: true,
                },
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
        take: 8,
        include: {
          tool: { select: { name: true } },
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
        take: 8,
        include: {
          tool: { select: { name: true } },
          service: {
            select: {
              name: true,
              application: { select: { name: true } },
            },
          },
        },
      }),
      prisma.qualityGate.findMany({
        select: {
          id: true,
          applicationId: true,
          scoreThreshold: true,
        },
      }),
    ]);

  const countBySeverity = new Map(
    counts.map(({ severity, _count }) => [severity, _count]),
  );

  let totalServicesCount = 0;
  const scores = applications.map((application) => {
    const services = application.services.map((service) => {
      totalServicesCount += 1;
      const severityCounts = new Map<IssueSeverity, number>();
      for (const issue of service.issues) {
        severityCounts.set(
          issue.severity,
          (severityCounts.get(issue.severity) ?? 0) + 1,
        );
      }
      return {
        ...service,
        score: serviceScore(service.issues),
        severityCounts,
        coverage: service.scans[0] ?? null,
      };
    });
    return {
      ...application,
      services,
      score: applicationScore(services.map(({ score }) => score)),
    };
  });

  // Calculate high-level ASPM posture metrics
  const totalOpenIssues = counts.reduce((acc, curr) => acc + curr._count, 0);
  const criticalCount = countBySeverity.get(IssueSeverity.critical) ?? 0;
  const highCount = countBySeverity.get(IssueSeverity.high) ?? 0;
  const urgentCount = criticalCount + highCount;

  // Average posture score across applications
  const validScores = scores
    .map((a) => a.score)
    .filter((s): s is number => s !== null);
  const averagePostureScore = validScores.length
    ? Math.round(
        validScores.reduce((sum, score) => sum + score, 0) / validScores.length,
      )
    : 100;

  // Gate compliance calculation
  let passingGatesCount = 0;
  for (const gate of qualityGates) {
    const app = scores.find((a) => a.id === gate.applicationId);
    if (app && app.score !== null) {
      if (gate.scoreThreshold === null || app.score >= gate.scoreThreshold) {
        passingGatesCount += 1;
      }
    }
  }
  const gateComplianceRate = qualityGates.length
    ? Math.round((passingGatesCount / qualityGates.length) * 100)
    : 100;

  const recent = [
    ...regressions.map((issue) => ({
      ...issue,
      event: "Regression" as const,
      eventAt: issue.regressionAt!,
    })),
    ...newIssues.map((issue) => ({
      ...issue,
      event: "New" as const,
      eventAt: issue.firstSeenAt,
    })),
  ]
    .sort((a, b) => b.eventAt.getTime() - a.eventAt.getTime())
    .slice(0, 8);

  const postureTone = scoreTone(averagePostureScore);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          Security Center
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Application Security Posture Management (ASPM) and developer software
          quality gate overview.
        </p>
      </div>

      {/* Posture Overview Hero Metrics */}
      <section aria-label="Security Posture Metrics">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Posture Score"
            value={`${averagePostureScore}/100`}
            subtext={`Health: ${scoreLabel(averagePostureScore)}`}
            icon={Shield}
            tone={postureTone}
          />
          <StatCard
            title="Open Vulnerabilities"
            value={totalOpenIssues}
            subtext="Click to view all active findings"
            icon={ShieldAlert}
            href="/issues?status=open"
            tone={totalOpenIssues > 0 ? "warn" : "good"}
          />
          <StatCard
            title="Critical & High"
            value={urgentCount}
            subtext="Gate-relevant exposures"
            icon={Flame}
            href="/issues?severity=critical"
            tone={urgentCount > 0 ? "bad" : "good"}
          />
          <StatCard
            title="Gate Compliance"
            value={`${gateComplianceRate}%`}
            subtext={`${passingGatesCount} of ${qualityGates.length} gates passing`}
            icon={ShieldCheck}
            href="/gates"
            tone={gateComplianceRate >= 90 ? "good" : "warn"}
          />
        </div>
      </section>

      {/* Severity Breakdown Bar */}
      <section>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-lg">
            Active Findings by Severity
          </h2>
          <Link
            href="/issues"
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <span>View all issues</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {Object.values(IssueSeverity).map((severity) => {
            const count = countBySeverity.get(severity) ?? 0;
            return (
              <Link
                key={severity}
                href={`/issues?severity=${severity}&status=open`}
                className="group relative flex flex-col justify-between rounded-xl border border-zinc-200 bg-card p-3.5 transition-all hover:border-zinc-300 hover:shadow-xs dark:border-zinc-800 dark:hover:border-zinc-700"
              >
                <div className="flex items-center justify-between">
                  <Badge variant={severity} dot>
                    <span className="capitalize">{severity}</span>
                  </Badge>
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
                    {count}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    open findings
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Applications & Software Catalogue Health */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-lg">
              Software Catalogue Security Health
            </h2>
            <p className="text-xs text-zinc-500">
              {applications.length} applications with {totalServicesCount}{" "}
              registered services.
            </p>
          </div>
          <Link
            href="/catalog"
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <Boxes className="h-3.5 w-3.5" />
            <span>Manage catalogue</span>
          </Link>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {scores.map((application) => (
            <article
              key={application.id}
              className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-card p-4 sm:p-5 dark:border-zinc-800 shadow-xs"
            >
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {application.name}
                    </h3>
                    <p className="text-xs text-zinc-500">/{application.slug}</p>
                  </div>
                  <div className="w-full sm:w-44">
                    <ScoreBar value={application.score} label="Group score" />
                  </div>
                </div>

                <ul className="mt-4 space-y-2.5">
                  {application.services.map((service) => (
                    <li
                      key={service.id}
                      className="rounded-lg border border-zinc-100 bg-zinc-50/70 p-3 text-sm dark:border-zinc-800/60 dark:bg-zinc-900/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {service.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-28 sm:w-32">
                            <ScoreBar value={service.score} compact />
                          </div>
                          <Link
                            href={`/issues?serviceId=${service.id}`}
                            title="View service issues"
                            className="inline-flex items-center justify-center rounded-md p-1 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                      <div className="mt-2.5 space-y-2">
                        <CoverageBar
                          line={service.coverage?.coverageLine}
                          branch={service.coverage?.coverageBranch}
                          fn={service.coverage?.coverageFunction}
                          source={service.coverage?.coverageSource}
                        />
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-zinc-500">
                          {SCORE_WEIGHTS.map(({ label }) => {
                            const count =
                              service.severityCounts.get(
                                label.toUpperCase() as IssueSeverity,
                              ) ?? 0;
                            return (
                              <span
                                key={label}
                                className={
                                  count > 0
                                    ? "font-medium text-zinc-700 dark:text-zinc-300"
                                    : "opacity-60"
                                }
                              >
                                {label[0]}: {count}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </li>
                  ))}
                  {!application.services.length && (
                    <li className="py-2 text-center text-xs text-zinc-500">
                      No services configured in this application.
                    </li>
                  )}
                </ul>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                <Link
                  href={`/issues?appId=${application.id}`}
                  className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 inline-flex items-center gap-1"
                >
                  View application findings
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </article>
          ))}
          {!scores.length && (
            <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 lg:col-span-2 dark:border-zinc-700">
              No applications in catalogue yet.{" "}
              <Link
                href="/catalog"
                className="font-medium text-zinc-900 underline dark:text-zinc-100"
              >
                Add your first application
              </Link>
            </div>
          )}
        </div>
        <ScoreLegend />
      </section>

      {/* Recent Security Activity */}
      <section>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-lg">
            Recent Gate-Relevant Activity (High & Critical)
          </h2>
          <span className="text-xs text-zinc-500">
            Real-time scanner reconciliation
          </span>
        </div>
        <div className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-card overflow-hidden dark:divide-zinc-800 dark:border-zinc-800 shadow-xs">
          {recent.map((issue) => (
            <Link
              key={issue.id}
              href={`/issues/${issue.id}`}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={issue.severity} dot>
                    <span className="capitalize">{issue.severity}</span>
                  </Badge>
                  <span
                    className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                      issue.event === "Regression"
                        ? "bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300"
                    }`}
                  >
                    {issue.event}
                  </span>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {issue.tool.name}
                  </span>
                </div>
                <p className="mt-1.5 font-medium text-zinc-900 dark:text-zinc-100 truncate text-sm">
                  {issue.title}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {issue.service.application.name} / {issue.service.name}
                </p>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <time className="text-xs text-zinc-500 font-mono">
                  {issue.eventAt.toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            </Link>
          ))}
          {!recent.length && (
            <div className="p-8 text-center text-sm text-zinc-500">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 opacity-80" />
              <p className="mt-2 font-medium text-zinc-900 dark:text-zinc-100">
                No active High or Critical findings
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                All quality gate critical thresholds are currently passing.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ScoreLegend() {
  return (
    <details className="mt-4 rounded-xl border border-zinc-200 bg-card p-4 text-sm dark:border-zinc-800">
      <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-200">
        How security scores are calculated
      </summary>
      <div className="mt-3 space-y-2 text-zinc-600 dark:text-zinc-400">
        <p>
          Each service begins at 100 points. Open and in-progress findings
          deduct penalty points according to their severity. The application
          group score is determined by its lowest service score.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {SCORE_WEIGHTS.map(({ label, weight }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
            >
              <span className="font-medium">{label}</span>
              <span className="tabular-nums text-red-600 dark:text-red-400 font-semibold">
                −{weight}
              </span>
            </span>
          ))}
        </div>
        <p className="text-xs text-zinc-500 pt-1">
          Health tiers: Good (90–100) · Needs attention (70–89) · Critical
          (below 70)
        </p>
      </div>
    </details>
  );
}
