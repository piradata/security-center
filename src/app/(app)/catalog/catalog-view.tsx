"use client";

import {
  Boxes,
  ExternalLink,
  Filter,
  Plus,
  Search,
  Settings2,
  ShieldAlert,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { CoverageBar } from "@/components/coverage-bar";
import { ScoreBar } from "@/components/score-bar";
import { Badge } from "@/components/ui/badge";
import { effectiveToolConfig } from "@/lib/catalog";
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
  "w-full rounded-lg border border-zinc-300 bg-background px-3 py-2 text-sm outline-hidden focus:border-zinc-500 focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 min-h-10";
const secondaryButton =
  "inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-background px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer min-h-9";
const dangerButton =
  "inline-flex items-center justify-center rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/60 transition-colors cursor-pointer min-h-9";

type Tool = {
  id: string;
  name: string;
  key: string;
  description: string | null;
};

type ServiceItem = {
  id: string;
  name: string;
  slug: string;
  tokenHash: string | null;
  score: number | null;
  serviceToolConfigs: { toolId: string; enabled: boolean }[];
  scans: {
    coverageLine: number | null;
    coverageBranch: number | null;
    coverageFunction: number | null;
    coverageSource: string | null;
  }[];
  _count?: {
    issues: number;
  };
};

type ApplicationItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  score: number | null;
  appToolConfigs: { toolId: string; enabled: boolean }[];
  services: ServiceItem[];
};

export function CatalogView({
  applications,
  tools,
}: {
  applications: ApplicationItem[];
  tools: Tool[];
}) {
  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState<
    "all" | "healthy" | "warn" | "bad" | "untokened"
  >("all");
  const [sortBy, setSortBy] = useState<"name" | "score-asc" | "score-desc">(
    "name",
  );
  const [isAddAppOpen, setIsAddAppOpen] = useState(false);

  // Filter & sort logic
  const filteredApplications = useMemo(() => {
    const q = search.toLowerCase().trim();

    return applications
      .map((app) => {
        // Filter services within application
        const matchingServices = app.services.filter((svc) => {
          // Health filter
          if (healthFilter === "healthy") {
            if (svc.score === null || svc.score < 90) return false;
          } else if (healthFilter === "warn") {
            if (svc.score === null || svc.score < 70 || svc.score >= 90)
              return false;
          } else if (healthFilter === "bad") {
            if (svc.score === null || svc.score >= 70) return false;
          } else if (healthFilter === "untokened") {
            if (svc.tokenHash !== null) return false;
          }

          // Search query
          if (!q) return true;
          return (
            svc.name.toLowerCase().includes(q) ||
            svc.slug.toLowerCase().includes(q) ||
            app.name.toLowerCase().includes(q) ||
            app.slug.toLowerCase().includes(q)
          );
        });

        // App matches query directly?
        const appMatchesDirectly =
          !q ||
          app.name.toLowerCase().includes(q) ||
          app.slug.toLowerCase().includes(q) ||
          (app.description?.toLowerCase().includes(q) ?? false);

        // Keep app if it matches search directly (and no strict health filter active) or has matching services
        const shouldKeep =
          matchingServices.length > 0 ||
          (appMatchesDirectly && healthFilter === "all");

        return {
          ...app,
          visibleServices:
            healthFilter !== "all" || q ? matchingServices : app.services,
          shouldKeep,
        };
      })
      .filter((app) => app.shouldKeep)
      .sort((a, b) => {
        if (sortBy === "name") {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === "score-asc") {
          return (a.score ?? 0) - (b.score ?? 0);
        }
        return (b.score ?? 0) - (a.score ?? 0);
      });
  }, [applications, search, healthFilter, sortBy]);

  return (
    <div className="space-y-6">
      {/* Search, Filter & Action Toolbar */}
      <div className="rounded-xl border border-zinc-200 bg-card p-4 dark:border-zinc-800 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search applications, services, or slugs..."
              className="w-full rounded-lg border border-zinc-300 bg-background pl-10 pr-4 py-2 text-sm outline-hidden focus:border-zinc-500 focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 min-h-11"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Add Application Button */}
          <button
            type="button"
            onClick={() => setIsAddAppOpen(!isAddAppOpen)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-colors cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add Application</span>
          </button>
        </div>

        {/* Filter Pills and Sort Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-zinc-100 dark:border-zinc-800 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-zinc-500 mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" />
              Filter:
            </span>
            <button
              type="button"
              onClick={() => setHealthFilter("all")}
              className={`rounded-full px-2.5 py-1 transition-colors cursor-pointer ${
                healthFilter === "all"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              All Services
            </button>
            <button
              type="button"
              onClick={() => setHealthFilter("healthy")}
              className={`rounded-full px-2.5 py-1 transition-colors cursor-pointer ${
                healthFilter === "healthy"
                  ? "bg-emerald-600 text-white font-semibold"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              Healthy (90+)
            </button>
            <button
              type="button"
              onClick={() => setHealthFilter("warn")}
              className={`rounded-full px-2.5 py-1 transition-colors cursor-pointer ${
                healthFilter === "warn"
                  ? "bg-amber-600 text-white font-semibold"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              Warning (70–89)
            </button>
            <button
              type="button"
              onClick={() => setHealthFilter("bad")}
              className={`rounded-full px-2.5 py-1 transition-colors cursor-pointer ${
                healthFilter === "bad"
                  ? "bg-red-600 text-white font-semibold"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              At Risk (&lt;70)
            </button>
            <button
              type="button"
              onClick={() => setHealthFilter("untokened")}
              className={`rounded-full px-2.5 py-1 transition-colors cursor-pointer ${
                healthFilter === "untokened"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              Missing CI Token
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium text-zinc-500">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "name" | "score-asc" | "score-desc")
              }
              className="rounded-md border border-zinc-300 bg-background px-2.5 py-1 text-xs outline-hidden focus:border-zinc-500 dark:border-zinc-700"
            >
              <option value="name">Name (A-Z)</option>
              <option value="score-asc">Lowest Score First</option>
              <option value="score-desc">Highest Score First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Collapsible Add Application Card */}
      {isAddAppOpen && (
        <section className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/40 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Register New Application
            </h2>
            <button
              type="button"
              onClick={() => setIsAddAppOpen(false)}
              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            Applications group your microservices and enforce aggregate quality
            gates.
          </p>

          <form
            action={async (formData) => {
              await createApplication(formData);
              setIsAddAppOpen(false);
            }}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <label className="text-xs">
              <span className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">
                Application Name
              </span>
              <input
                required
                maxLength={120}
                name="name"
                placeholder="e.g. Payments Platform"
                className={input}
              />
            </label>
            <label className="text-xs">
              <span className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">
                Slug (URL identifier)
              </span>
              <input
                required
                maxLength={80}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                name="slug"
                placeholder="e.g. payments-platform"
                className={input}
              />
            </label>
            <label className="text-xs sm:col-span-2">
              <span className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">
                Description (Optional)
              </span>
              <textarea
                maxLength={500}
                name="description"
                rows={2}
                placeholder="Brief summary of the application domain..."
                className={input}
              />
            </label>
            <div className="flex items-center gap-2 sm:col-span-2 pt-1">
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-colors cursor-pointer min-h-10"
              >
                Create Application
              </button>
              <button
                type="button"
                onClick={() => setIsAddAppOpen(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer min-h-10"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Catalogue Applications List */}
      <div className="space-y-6">
        {filteredApplications.map((application) => {
          const appDefaults = new Map(
            application.appToolConfigs.map((config) => [
              config.toolId,
              config.enabled,
            ]),
          );

          return (
            <section
              key={application.id}
              className="rounded-xl border border-zinc-200 bg-card p-5 dark:border-zinc-800 shadow-xs space-y-5"
            >
              {/* Application Top Bar */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 sm:text-xl">
                      {application.name}
                    </h2>
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      /{application.slug}
                    </span>
                    <span className="text-xs text-zinc-400">
                      ({application.services.length} services)
                    </span>
                  </div>
                  {application.description && (
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                      {application.description}
                    </p>
                  )}
                </div>

                <div className="w-full sm:w-44 shrink-0">
                  <ScoreBar value={application.score} label="Group Score" />
                </div>
              </div>

              {/* Application Management Actions (Collapsible) */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                <details className="group">
                  <summary className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer select-none">
                    <Settings2 className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Application Settings</span>
                  </summary>
                  <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40 space-y-4">
                    <form
                      action={updateApplication.bind(null, application.id)}
                      className="grid gap-3 sm:grid-cols-2"
                    >
                      <label className="text-xs">
                        <span className="mb-1 block font-medium">Name</span>
                        <input
                          required
                          maxLength={120}
                          name="name"
                          defaultValue={application.name}
                          className={input}
                        />
                      </label>
                      <label className="text-xs">
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
                      <label className="text-xs sm:col-span-2">
                        <span className="mb-1 block font-medium">
                          Description
                        </span>
                        <textarea
                          maxLength={500}
                          name="description"
                          rows={2}
                          defaultValue={application.description ?? ""}
                          className={input}
                        />
                      </label>
                      <div className="sm:col-span-2">
                        <button type="submit" className={secondaryButton}>
                          Save application
                        </button>
                      </div>
                    </form>
                    <form
                      action={deleteApplication.bind(null, application.id)}
                      className="pt-2 border-t border-zinc-200 dark:border-zinc-700"
                    >
                      <button type="submit" className={dangerButton}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete Application and All Services
                      </button>
                    </form>
                  </div>
                </details>

                <details className="group">
                  <summary className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer select-none">
                    <Boxes className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Application Tool Defaults</span>
                  </summary>
                  <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <p className="text-xs text-zinc-500 mb-3">
                      Services inherit these defaults unless they define an
                      override.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {tools.map((tool) => (
                        <form
                          key={tool.id}
                          action={updateApplicationTool.bind(
                            null,
                            application.id,
                            tool.id,
                          )}
                          className="flex items-end gap-2 rounded-md border border-zinc-200 bg-background p-2.5 dark:border-zinc-700"
                        >
                          <label className="min-w-0 flex-1 text-xs">
                            <span className="mb-1 block font-medium truncate">
                              {tool.name}
                            </span>
                            <select
                              name="enabled"
                              defaultValue={String(
                                appDefaults.get(tool.id) ?? true,
                              )}
                              className="w-full rounded border border-zinc-300 bg-background px-2 py-1 text-xs dark:border-zinc-700"
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
                </details>
              </div>

              {/* Services List for this Application */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Services ({application.visibleServices.length})
                  </h3>
                </div>

                <div className="grid gap-3">
                  {application.visibleServices.map((service) => {
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

                    const hasToken = Boolean(service.tokenHash);
                    const pipelineCurl = `curl -fsSL -H "Authorization: Bearer $SC_TOKEN" "$SC_URL/api/v1/ci/scan.sh" | bash`;

                    return (
                      <article
                        key={service.id}
                        className="rounded-xl border border-zinc-200/90 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 space-y-3.5"
                      >
                        {/* Service Header Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm sm:text-base">
                                {service.name}
                              </h4>
                              <span className="rounded bg-zinc-200/70 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                /{service.slug}
                              </span>
                              {hasToken ? (
                                <Badge variant="success" dot>
                                  CI Active
                                </Badge>
                              ) : (
                                <Badge variant="warning" dot>
                                  Setup Needed
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="w-28 sm:w-36">
                              <ScoreBar value={service.score} compact />
                            </div>
                            <CoverageBar
                              line={service.scans[0]?.coverageLine}
                              compact
                            />
                            <Link
                              href={`/issues?serviceId=${service.id}`}
                              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-background px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors shrink-0"
                            >
                              <ShieldAlert className="h-3 w-3 text-zinc-400" />
                              <span>Issues</span>
                              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                            </Link>
                          </div>
                        </div>

                        {/* Interactive Drawer for CI Pipeline & Tokens */}
                        <div className="flex flex-wrap items-center gap-2 text-xs pt-1 border-t border-zinc-200/50 dark:border-zinc-800/80">
                          <details className="group/ci">
                            <summary className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer select-none">
                              <Terminal className="h-3.5 w-3.5" />
                              <span>CI Pipeline & Token</span>
                            </summary>
                            <div className="mt-3 rounded-lg border border-zinc-200 bg-background p-3.5 dark:border-zinc-700 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-xs text-zinc-800 dark:text-zinc-200">
                                    CI Runner Token (SC_TOKEN)
                                  </p>
                                  <p className="text-[11px] text-zinc-500">
                                    {hasToken
                                      ? "Active bearer credential generated"
                                      : "No token configured yet"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <RotateTokenForm
                                    serviceId={service.id}
                                    hasToken={hasToken}
                                  />
                                  {hasToken && (
                                    <form
                                      action={revokeServiceToken.bind(
                                        null,
                                        service.id,
                                      )}
                                    >
                                      <button
                                        type="submit"
                                        className={dangerButton}
                                      >
                                        Revoke Token
                                      </button>
                                    </form>
                                  )}
                                </div>
                              </div>

                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                                    One-line CI Pipeline Scan Command:
                                  </span>
                                  <CopyButton
                                    text={pipelineCurl}
                                    label="Copy Command"
                                  />
                                </div>
                                <div className="overflow-x-auto rounded-md bg-zinc-950 p-2.5 dark:bg-black border border-zinc-800">
                                  <code className="block font-mono text-xs text-zinc-200 whitespace-pre">
                                    {pipelineCurl}
                                  </code>
                                </div>
                              </div>
                            </div>
                          </details>

                          <details className="group/tools">
                            <summary className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer select-none">
                              <Settings2 className="h-3.5 w-3.5" />
                              <span>Tool Overrides</span>
                            </summary>
                            <div className="mt-3 rounded-lg border border-zinc-200 bg-background p-3.5 dark:border-zinc-700">
                              <p className="text-[11px] text-zinc-500 mb-2">
                                Override scanner settings specifically for this
                                service:
                              </p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {effective.map((tool) => (
                                  <form
                                    key={tool.id}
                                    action={updateServiceTool.bind(
                                      null,
                                      service.id,
                                      tool.id,
                                    )}
                                    className="flex items-end gap-2 rounded border border-zinc-100 p-2 dark:border-zinc-800"
                                  >
                                    <label className="min-w-0 flex-1 text-xs">
                                      <span className="mb-1 block truncate">
                                        <strong className="font-semibold">
                                          {tool.name}
                                        </strong>{" "}
                                        <span className="text-zinc-400 text-[10px]">
                                          ({tool.enabled ? "active" : "off"})
                                        </span>
                                      </span>
                                      <select
                                        name="enabled"
                                        defaultValue={
                                          overrides.has(tool.id)
                                            ? String(overrides.get(tool.id))
                                            : "inherit"
                                        }
                                        className="w-full rounded border border-zinc-300 bg-background px-2 py-1 text-xs dark:border-zinc-700"
                                      >
                                        <option value="inherit">
                                          Inherit application
                                        </option>
                                        <option value="true">Enable</option>
                                        <option value="false">Disable</option>
                                      </select>
                                    </label>
                                    <button
                                      type="submit"
                                      className={secondaryButton}
                                    >
                                      Save
                                    </button>
                                  </form>
                                ))}
                              </div>
                            </div>
                          </details>

                          <details className="group/edit">
                            <summary className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer select-none">
                              <span>Edit Service</span>
                            </summary>
                            <div className="mt-3 rounded-lg border border-zinc-200 bg-background p-3.5 dark:border-zinc-700 space-y-3">
                              <form
                                action={updateService.bind(null, service.id)}
                                className="grid gap-3 sm:grid-cols-2"
                              >
                                <label className="text-xs">
                                  <span className="mb-1 block font-medium">
                                    Name
                                  </span>
                                  <input
                                    required
                                    maxLength={120}
                                    name="name"
                                    defaultValue={service.name}
                                    className={input}
                                  />
                                </label>
                                <label className="text-xs">
                                  <span className="mb-1 block font-medium">
                                    Slug
                                  </span>
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
                                  <button
                                    type="submit"
                                    className={secondaryButton}
                                  >
                                    Save Service
                                  </button>
                                </div>
                              </form>
                              <form
                                action={deleteService.bind(null, service.id)}
                              >
                                <button type="submit" className={dangerButton}>
                                  Delete Service
                                </button>
                              </form>
                            </div>
                          </details>
                        </div>
                      </article>
                    );
                  })}

                  {application.visibleServices.length === 0 && (
                    <p className="rounded-lg border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-500 dark:border-zinc-800">
                      No services found matching current filters.
                    </p>
                  )}
                </div>

                {/* Add Service Section */}
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-zinc-800 dark:text-zinc-200 inline-flex items-center gap-1 hover:underline select-none">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Register new service for {application.name}</span>
                  </summary>
                  <CreateServiceForm applicationId={application.id} />
                </details>
              </div>
            </section>
          );
        })}

        {filteredApplications.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
            <Boxes className="mx-auto h-8 w-8 text-zinc-400 opacity-60" />
            <p className="mt-2 font-medium text-zinc-800 dark:text-zinc-200">
              No applications or services match your criteria
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Clear your search query or reset health filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
