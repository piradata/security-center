import { AlertOctagon, CheckCircle2, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ScoreBar } from "@/components/score-bar";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createQualityGate,
  deleteQualityGate,
  updateQualityGate,
} from "./actions";

const input =
  "w-full rounded-lg border border-zinc-300 bg-background px-3 py-2 text-sm outline-hidden focus:border-zinc-500 focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 min-h-10";
const secondaryButton =
  "inline-flex items-center justify-center rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer min-h-9";
const dangerButton =
  "inline-flex items-center text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 hover:underline cursor-pointer";

export default async function GatesPage() {
  if (!(await auth())?.user) redirect("/login");

  const applications = await prisma.application.findMany({
    orderBy: { name: "asc" },
    include: {
      services: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, score: true },
      },
      qualityGates: { orderBy: { name: "asc" } },
    },
  });

  // Calculate high-level gate metrics
  let totalGates = 0;
  let passingGates = 0;
  let failingGates = 0;

  for (const app of applications) {
    for (const gate of app.qualityGates) {
      totalGates += 1;
      if (app.score === null || gate.scoreThreshold === null) {
        // awaiting
      } else if (app.score >= gate.scoreThreshold) {
        passingGates += 1;
      } else {
        failingGates += 1;
      }
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          Quality Gates
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Enforce automated CI pass/fail policies based on application scores
          and high-severity findings.
        </p>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          title="Total Gates"
          value={totalGates}
          subtext="Configured policies"
          icon={ShieldCheck}
        />
        <StatCard
          title="Passing Gates"
          value={passingGates}
          subtext="Meeting quality thresholds"
          icon={CheckCircle2}
          tone="good"
        />
        <StatCard
          title="Failing Gates"
          value={failingGates}
          subtext="Blocking CI deployments"
          icon={AlertOctagon}
          tone={failingGates > 0 ? "bad" : "good"}
        />
      </div>

      {/* Applications & Gates List */}
      <div className="space-y-6">
        {applications.map((application) => {
          const score = application.score;
          return (
            <section
              key={application.id}
              className="rounded-xl border border-zinc-200 bg-card p-5 dark:border-zinc-800 shadow-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 sm:text-xl">
                    {application.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {application.services.length} registered service
                    {application.services.length === 1 ? "" : "s"} · Group score
                    is min(services)
                  </p>
                </div>
                <div className="w-full sm:w-48">
                  <ScoreBar value={score} label="Group score" />
                </div>
              </div>

              {application.services.length > 0 && (
                <div className="mt-4 rounded-lg bg-zinc-50/70 p-3.5 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                    Service Scores:
                  </p>
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {application.services.map((service) => (
                      <li key={service.id}>
                        <ScoreBar
                          value={service.score}
                          label={service.name}
                          compact
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Quality Gate Policies ({application.qualityGates.length})
                </h3>

                {application.qualityGates.map((gate) => {
                  const isPassing =
                    score !== null &&
                    gate.scoreThreshold !== null &&
                    score >= gate.scoreThreshold;
                  const isFailing =
                    score !== null &&
                    gate.scoreThreshold !== null &&
                    score < gate.scoreThreshold;
                  const isAwaiting =
                    score === null || gate.scoreThreshold === null;

                  return (
                    <article
                      key={gate.id}
                      className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                            {gate.name}
                          </h4>
                          {isPassing && (
                            <Badge variant="success" dot>
                              Passing
                            </Badge>
                          )}
                          {isFailing && (
                            <Badge variant="danger" dot>
                              Failing
                            </Badge>
                          )}
                          {isAwaiting && (
                            <Badge variant="neutral">Awaiting Run</Badge>
                          )}
                        </div>

                        <div className="text-xs text-zinc-500">
                          {gate.scoreThreshold !== null ? (
                            <span>
                              Threshold:{" "}
                              <strong className="text-zinc-800 dark:text-zinc-200">
                                ≥{gate.scoreThreshold}
                              </strong>
                            </span>
                          ) : (
                            <span>No minimum score set</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 w-full sm:w-72">
                        <ScoreBar
                          value={score}
                          label="Gate evaluation"
                          threshold={gate.scoreThreshold}
                          compact
                        />
                      </div>

                      <div className="mt-2 text-xs text-zinc-500">
                        {gate.failOnNewHighCritical
                          ? "✓ Fails if new High/Critical findings are introduced"
                          : "○ Ignores new High/Critical findings"}
                      </div>

                      {/* Edit Gate */}
                      <details className="mt-3 pt-2 border-t border-zinc-200/60 dark:border-zinc-800">
                        <summary className="cursor-pointer text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 select-none">
                          Edit policy rules
                        </summary>
                        <form
                          action={updateQualityGate.bind(null, gate.id)}
                          className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3"
                        >
                          <label className="text-xs">
                            <span className="mb-1 block font-medium">Name</span>
                            <input
                              required
                              maxLength={80}
                              name="name"
                              defaultValue={gate.name}
                              className={input}
                            />
                          </label>
                          <label className="text-xs">
                            <span className="mb-1 block font-medium">
                              Minimum score (0–100)
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              name="scoreThreshold"
                              defaultValue={gate.scoreThreshold ?? ""}
                              placeholder="No threshold"
                              className={input}
                            />
                          </label>
                          <label className="flex items-center gap-2 self-end py-2 text-xs cursor-pointer sm:col-span-2 md:col-span-1">
                            <input
                              type="checkbox"
                              name="failOnNewHighCritical"
                              defaultChecked={gate.failOnNewHighCritical}
                              className="h-4 w-4 rounded-sm border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-700"
                            />
                            Fail on new High/Critical
                          </label>
                          <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2 md:col-span-3 pt-2">
                            <button type="submit" className={secondaryButton}>
                              Save changes
                            </button>
                            <button
                              formAction={deleteQualityGate.bind(null, gate.id)}
                              type="submit"
                              className={dangerButton}
                            >
                              Delete gate
                            </button>
                          </div>
                        </form>
                      </details>
                    </article>
                  );
                })}

                {application.qualityGates.length === 0 && (
                  <p className="rounded-lg border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-500 dark:border-zinc-800">
                    No quality gates configured for this application yet.
                  </p>
                )}
              </div>

              {/* Add quality gate */}
              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-semibold text-zinc-800 dark:text-zinc-200 inline-flex items-center gap-1 hover:underline select-none">
                  <Plus className="h-3.5 w-3.5" />
                  Add quality gate policy
                </summary>
                <form
                  action={createQualityGate}
                  className="mt-3 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 sm:grid-cols-2 md:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-900/30"
                >
                  <input
                    type="hidden"
                    name="applicationId"
                    value={application.id}
                  />
                  <label className="text-xs">
                    <span className="mb-1 block font-medium">Policy Name</span>
                    <input
                      required
                      maxLength={80}
                      name="name"
                      placeholder="e.g. production-gate"
                      className={input}
                    />
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block font-medium">
                      Minimum score (0–100)
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      name="scoreThreshold"
                      placeholder="e.g. 80"
                      className={input}
                    />
                  </label>
                  <label className="flex items-center gap-2 self-end py-2 text-xs cursor-pointer sm:col-span-2 md:col-span-1">
                    <input
                      type="checkbox"
                      name="failOnNewHighCritical"
                      defaultChecked
                      className="h-4 w-4 rounded-sm border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-700"
                    />
                    Fail on new High/Critical
                  </label>
                  <div className="sm:col-span-2 md:col-span-3 pt-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-colors cursor-pointer min-h-9"
                    >
                      Create Gate Policy
                    </button>
                  </div>
                </form>
              </details>
            </section>
          );
        })}

        {applications.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            Create an application in the{" "}
            <Link
              href="/catalog"
              className="font-semibold text-zinc-900 dark:text-zinc-100 underline"
            >
              Software Catalogue
            </Link>{" "}
            before configuring quality gates.
          </div>
        )}
      </div>
    </div>
  );
}
