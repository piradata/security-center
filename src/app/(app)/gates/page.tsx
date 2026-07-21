import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createQualityGate, deleteQualityGate, updateQualityGate } from "./actions";

const input =
  "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";
const secondaryButton =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

export default async function GatesPage() {
  if (!(await auth())?.user) redirect("/login");

  const applications = await prisma.application.findMany({
    orderBy: { name: "asc" },
    include: {
      services: { orderBy: { name: "asc" }, select: { id: true, name: true, score: true } },
      qualityGates: { orderBy: { name: "asc" } },
    },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">Gates</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Application scores are the lowest available service score. Configure one or
        more named policies per application.
      </p>

      <div className="mt-6 space-y-6">
        {applications.map((application) => {
          const score = application.score;
          return (
            <section
              key={application.id}
              className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{application.name}</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {application.services.length} service
                    {application.services.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium dark:bg-zinc-800">
                  Group score: {score ?? "not scanned"}
                </span>
              </div>

              {application.services.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2" aria-label="Service scores">
                  {application.services.map((service) => (
                    <li
                      key={service.id}
                      className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs dark:border-zinc-800"
                    >
                      {service.name}: {service.score ?? "not scanned"}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5 space-y-3">
                {application.qualityGates.map((gate) => {
                  const scoreState =
                    score === null || gate.scoreThreshold === null
                      ? "Awaiting score"
                      : score >= gate.scoreThreshold
                        ? "Passing score"
                        : "Failing score";
                  return (
                    <article
                      key={gate.id}
                      className="rounded-md bg-zinc-50 p-4 dark:bg-zinc-900"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-medium">{gate.name}</h3>
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          {scoreState}
                        </span>
                      </div>
                      <form
                        action={updateQualityGate.bind(null, gate.id)}
                        className="mt-3 grid gap-3 md:grid-cols-3"
                      >
                        <label className="text-sm">
                          <span className="mb-1 block font-medium">Name</span>
                          <input
                            required
                            maxLength={80}
                            name="name"
                            defaultValue={gate.name}
                            className={input}
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block font-medium">Minimum score</span>
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
                        <label className="flex items-center gap-2 self-end py-2 text-sm">
                          <input
                            type="checkbox"
                            name="failOnNewHighCritical"
                            defaultChecked={gate.failOnNewHighCritical}
                            className="size-4"
                          />
                          Fail on new High/Critical
                        </label>
                        <div className="flex flex-wrap gap-2 md:col-span-3">
                          <button type="submit" className={secondaryButton}>
                            Save gate
                          </button>
                        </div>
                      </form>
                      <form action={deleteQualityGate.bind(null, gate.id)} className="mt-2">
                        <button
                          type="submit"
                          className="text-sm font-medium text-red-700 hover:underline dark:text-red-400"
                        >
                          Delete gate
                        </button>
                      </form>
                    </article>
                  );
                })}
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium">Add quality gate</summary>
                <form
                  action={createQualityGate}
                  className="mt-3 grid gap-3 rounded-md border border-zinc-200 p-4 md:grid-cols-3 dark:border-zinc-800"
                >
                  <input type="hidden" name="applicationId" value={application.id} />
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Name</span>
                    <input required maxLength={80} name="name" className={input} />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Minimum score</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      name="scoreThreshold"
                      placeholder="No threshold"
                      className={input}
                    />
                  </label>
                  <label className="flex items-center gap-2 self-end py-2 text-sm">
                    <input
                      type="checkbox"
                      name="failOnNewHighCritical"
                      defaultChecked
                      className="size-4"
                    />
                    Fail on new High/Critical
                  </label>
                  <div className="md:col-span-3">
                    <button
                      type="submit"
                      className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      Create gate
                    </button>
                  </div>
                </form>
              </details>
            </section>
          );
        })}

        {applications.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            Create an application in Catalog before configuring gates.
          </p>
        )}
      </div>
    </div>
  );
}
