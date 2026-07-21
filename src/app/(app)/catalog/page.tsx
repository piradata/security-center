import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { effectiveToolConfig } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import {
  createApplication,
  deleteApplication,
  deleteService,
  revokeServiceToken,
  updateApplication,
  updateApplicationTool,
  updateService,
  updateServiceTool,
} from "./actions";
import { CreateServiceForm, RotateTokenForm } from "./token-controls";

const input =
  "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";
const secondaryButton =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";
const dangerButton =
  "rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950";

function Score({ value }: { value: number | null }) {
  return (
    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium dark:bg-zinc-800">
      Score {value ?? "not scanned"}
    </span>
  );
}

export default async function CatalogPage() {
  if (!(await auth())?.user) redirect("/login");

  const [applications, tools] = await Promise.all([
    prisma.application.findMany({
      orderBy: { name: "asc" },
      include: {
        appToolConfigs: true,
        services: {
          orderBy: { name: "asc" },
          include: { serviceToolConfigs: true },
        },
      },
    }),
    prisma.tool.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Manage applications, services, pipeline tokens, and effective tool settings.
        </p>
      </div>

      <section className="mt-6 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Add application</h2>
        <form action={createApplication} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Name</span>
            <input required maxLength={120} name="name" className={input} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Slug</span>
            <input
              required
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              name="slug"
              className={input}
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block font-medium">Description</span>
            <textarea maxLength={500} name="description" rows={2} className={input} />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Create application
            </button>
          </div>
        </form>
      </section>

      <div className="mt-6 space-y-6">
        {applications.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No applications yet.
          </p>
        )}

        {applications.map((application) => {
          const appDefaults = new Map(
            application.appToolConfigs.map((config) => [config.toolId, config.enabled]),
          );
          return (
            <section
              key={application.id}
              className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{application.name}</h2>
                  <p className="text-sm text-zinc-500">/{application.slug}</p>
                  {application.description && (
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {application.description}
                    </p>
                  )}
                </div>
                <Score value={application.score} />
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium">Edit application</summary>
                <form
                  action={updateApplication.bind(null, application.id)}
                  className="mt-3 grid gap-3 md:grid-cols-2"
                >
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Name</span>
                    <input
                      required
                      maxLength={120}
                      name="name"
                      defaultValue={application.name}
                      className={input}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Slug</span>
                    <input
                      required
                      maxLength={80}
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      name="slug"
                      defaultValue={application.slug}
                      className={input}
                    />
                  </label>
                  <label className="text-sm md:col-span-2">
                    <span className="mb-1 block font-medium">Description</span>
                    <textarea
                      maxLength={500}
                      name="description"
                      rows={2}
                      defaultValue={application.description ?? ""}
                      className={input}
                    />
                  </label>
                  <div className="flex gap-2 md:col-span-2">
                    <button type="submit" className={secondaryButton}>
                      Save application
                    </button>
                  </div>
                </form>
                <form action={deleteApplication.bind(null, application.id)} className="mt-3">
                  <button type="submit" className={dangerButton}>
                    Delete application and all services
                  </button>
                </form>
              </details>

              <div className="mt-6">
                <h3 className="font-semibold">Application tool defaults</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Services inherit these settings unless they define an override.
                </p>
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  {tools.map((tool) => (
                    <form
                      key={tool.id}
                      action={updateApplicationTool.bind(null, application.id, tool.id)}
                      className="flex items-end gap-2 rounded-md bg-zinc-50 p-3 dark:bg-zinc-900"
                    >
                      <label className="min-w-0 flex-1 text-sm">
                        <span className="mb-1 block font-medium">{tool.name}</span>
                        <select
                          name="enabled"
                          defaultValue={String(appDefaults.get(tool.id) ?? true)}
                          className={input}
                        >
                          <option value="true">Enabled</option>
                          <option value="false">Disabled</option>
                        </select>
                      </label>
                      <button type="submit" className={secondaryButton}>
                        Save
                      </button>
                    </form>
                  ))}
                </div>
              </div>

              <div className="mt-7">
                <h3 className="text-lg font-semibold">Services</h3>
                <div className="mt-3 space-y-4">
                  {application.services.map((service) => {
                    const effective = effectiveToolConfig(
                      tools,
                      application.appToolConfigs,
                      service.serviceToolConfigs,
                    );
                    const overrides = new Map(
                      service.serviceToolConfigs.map((config) => [
                        config.toolId,
                        config.enabled,
                      ]),
                    );

                    return (
                      <article
                        key={service.id}
                        className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h4 className="font-semibold">{service.name}</h4>
                            <p className="text-xs text-zinc-500">/{service.slug}</p>
                          </div>
                          <Score value={service.score} />
                        </div>

                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm font-medium">
                            Edit service
                          </summary>
                          <form
                            action={updateService.bind(null, service.id)}
                            className="mt-3 grid gap-3 sm:grid-cols-2"
                          >
                            <label className="text-sm">
                              <span className="mb-1 block font-medium">Name</span>
                              <input
                                required
                                maxLength={120}
                                name="name"
                                defaultValue={service.name}
                                className={input}
                              />
                            </label>
                            <label className="text-sm">
                              <span className="mb-1 block font-medium">Slug</span>
                              <input
                                required
                                maxLength={80}
                                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                                name="slug"
                                defaultValue={service.slug}
                                className={input}
                              />
                            </label>
                            <div className="sm:col-span-2">
                              <button type="submit" className={secondaryButton}>
                                Save service
                              </button>
                            </div>
                          </form>
                          <form action={deleteService.bind(null, service.id)} className="mt-3">
                            <button type="submit" className={dangerButton}>
                              Delete service
                            </button>
                          </form>
                        </details>

                        <div className="mt-4 rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h5 className="text-sm font-medium">CI service token</h5>
                              <p className="text-xs text-zinc-500">
                                {service.tokenHash ? "Active" : "No active token"}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <RotateTokenForm
                                serviceId={service.id}
                                hasToken={Boolean(service.tokenHash)}
                              />
                              {service.tokenHash && (
                                <form action={revokeServiceToken.bind(null, service.id)}>
                                  <button type="submit" className={dangerButton}>
                                    Revoke token
                                  </button>
                                </form>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4">
                          <h5 className="text-sm font-medium">Tool overrides</h5>
                          <div className="mt-2 grid gap-2 lg:grid-cols-2">
                            {effective.map((tool) => (
                              <form
                                key={tool.id}
                                action={updateServiceTool.bind(null, service.id, tool.id)}
                                className="flex items-end gap-2"
                              >
                                <label className="min-w-0 flex-1 text-sm">
                                  <span className="mb-1 block">
                                    {tool.name}{" "}
                                    <span className="text-xs text-zinc-500">
                                      (effective: {tool.enabled ? "on" : "off"})
                                    </span>
                                  </span>
                                  <select
                                    name="enabled"
                                    defaultValue={
                                      overrides.has(tool.id)
                                        ? String(overrides.get(tool.id))
                                        : "inherit"
                                    }
                                    className={input}
                                  >
                                    <option value="inherit">Inherit application default</option>
                                    <option value="true">Enabled override</option>
                                    <option value="false">Disabled override</option>
                                  </select>
                                </label>
                                <button type="submit" className={secondaryButton}>
                                  Save
                                </button>
                              </form>
                            ))}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  {application.services.length === 0 && (
                    <p className="text-sm text-zinc-500">No services yet.</p>
                  )}
                </div>
                <CreateServiceForm applicationId={application.id} />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
