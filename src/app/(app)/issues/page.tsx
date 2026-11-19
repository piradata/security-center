import {
  ChevronRight,
  Filter as FilterIcon,
  Search,
  ShieldAlert,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { IssueSeverity, IssueStatus } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { issueWhere } from "@/lib/issues-query";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const selectClass =
  "w-full rounded-lg border border-zinc-300 bg-background px-3 py-2 text-sm outline-hidden focus:border-zinc-500 focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 min-h-10";

function label(value: string) {
  return value.replaceAll("_", " ");
}

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!(await auth())?.user) redirect("/login");

  const values = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, Array.isArray(value) ? value[0] : value);
  }

  const queryQ = params.get("q") ?? "";

  const [issues, applications, services, tools, users] = await Promise.all([
    prisma.issue.findMany({
      where: issueWhere(params),
      orderBy: { lastSeenAt: "desc" },
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
    prisma.application.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.service.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        application: { select: { name: true } },
      },
    }),
    prisma.tool.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      orderBy: { email: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const activeFilterCount = Array.from(params.keys()).filter(
    (k) => params.get(k) !== "",
  ).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Findings Hub
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Reconciled scanner findings, vulnerability inventory, and quality
            gate compliance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 tabular-nums">
            {issues.length} {issues.length === 1 ? "finding" : "findings"}
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="rounded-xl border border-zinc-200 bg-card p-4 dark:border-zinc-800 shadow-xs">
        <form method="GET" action="/issues" className="space-y-4">
          {/* Text Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="search"
              name="q"
              defaultValue={queryQ}
              placeholder="Search findings by title, fingerprint, or CVE ID..."
              className="w-full rounded-lg border border-zinc-300 bg-background pl-10 pr-4 py-2 text-sm outline-hidden focus:border-zinc-500 focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 min-h-11"
            />
          </div>

          {/* Quick Filter Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-medium text-zinc-500 mr-1">Presets:</span>
            <Link
              href="/issues?status=open"
              className={`rounded-full px-2.5 py-1 transition-colors ${
                params.get("status") === "open"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              Open Issues
            </Link>
            <Link
              href="/issues?severity=critical"
              className={`rounded-full px-2.5 py-1 transition-colors ${
                params.get("severity") === "critical"
                  ? "bg-red-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              Critical Only
            </Link>
            <Link
              href="/issues?unassigned=true"
              className={`rounded-full px-2.5 py-1 transition-colors ${
                params.get("unassigned") === "true"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              Unassigned
            </Link>
            {activeFilterCount > 0 && (
              <Link
                href="/issues"
                className="ml-auto inline-flex items-center gap-1 text-red-600 hover:text-red-700 dark:text-red-400 text-xs font-medium"
              >
                <X className="h-3 w-3" />
                Clear filters
              </Link>
            )}
          </div>

          {/* Filter Dropdowns Grid */}
          <details
            open={activeFilterCount > 0}
            className="group border-t border-zinc-100 pt-3 dark:border-zinc-800"
          >
            <summary className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-600 dark:text-zinc-400 select-none">
              <FilterIcon className="h-3.5 w-3.5" />
              <span>Advanced Filters</span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-1.5 py-0.2 text-[10px]">
                  {activeFilterCount}
                </span>
              )}
            </summary>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 pt-1">
              <Filter
                name="appId"
                label="Application"
                value={params.get("appId")}
              >
                {applications.map((application) => (
                  <option key={application.id} value={application.id}>
                    {application.name}
                  </option>
                ))}
              </Filter>
              <Filter
                name="serviceId"
                label="Service"
                value={params.get("serviceId")}
              >
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.application.name} / {service.name}
                  </option>
                ))}
              </Filter>
              <Filter name="toolId" label="Tool" value={params.get("toolId")}>
                {tools.map((tool) => (
                  <option key={tool.id} value={tool.id}>
                    {tool.name}
                  </option>
                ))}
              </Filter>
              <Filter
                name="severity"
                label="Severity"
                value={params.get("severity")}
              >
                {Object.values(IssueSeverity).map((severity) => (
                  <option key={severity} value={severity}>
                    {label(severity)}
                  </option>
                ))}
              </Filter>
              <Filter name="status" label="Status" value={params.get("status")}>
                {Object.values(IssueStatus).map((status) => (
                  <option key={status} value={status}>
                    {label(status)}
                  </option>
                ))}
              </Filter>
              <Filter
                name="assigneeUserId"
                label="Assignee"
                value={params.get("assigneeUserId")}
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name ?? user.email}
                  </option>
                ))}
              </Filter>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-2">
              <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  name="unassigned"
                  value="true"
                  defaultChecked={params.get("unassigned") === "true"}
                  className="h-4 w-4 rounded-sm border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-700"
                />
                Show unassigned only
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-colors cursor-pointer min-h-9"
                >
                  Apply Filters
                </button>
                <Link
                  href="/issues"
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors min-h-9 inline-flex items-center"
                >
                  Reset
                </Link>
              </div>
            </div>
          </details>
        </form>
      </div>

      {/* Desktop Table View (lg and above) */}
      <div className="hidden lg:block overflow-hidden rounded-xl border border-zinc-200 bg-card dark:border-zinc-800 shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/70 text-xs font-semibold text-zinc-500 uppercase tracking-wider dark:border-zinc-800 dark:bg-zinc-900/50">
            <tr>
              <th className="px-4 py-3.5">Severity</th>
              <th className="px-4 py-3.5">Issue Finding</th>
              <th className="px-4 py-3.5">Service & App</th>
              <th className="px-4 py-3.5">Tool</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">Assignee</th>
              <th className="px-4 py-3.5">Last Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {issues.map((issue) => (
              <tr
                key={issue.id}
                className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 transition-colors group"
              >
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <Badge variant={issue.severity} dot>
                    <span className="capitalize">{issue.severity}</span>
                  </Badge>
                </td>
                <td className="max-w-md px-4 py-3.5">
                  <Link
                    href={`/issues/${issue.id}`}
                    className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline block truncate"
                  >
                    {issue.title}
                  </Link>
                  <p className="mt-0.5 font-mono text-[11px] text-zinc-400 truncate">
                    {issue.fingerprint}
                  </p>
                </td>
                <td className="px-4 py-3.5 text-zinc-700 dark:text-zinc-300 whitespace-nowrap text-xs">
                  <span className="font-medium">{issue.service.name}</span>
                  <span className="text-zinc-400 ml-1">
                    ({issue.service.application.name})
                  </span>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {issue.tool.name}
                  </span>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <Badge variant={issue.status}>
                    <span className="capitalize">{label(issue.status)}</span>
                  </Badge>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-xs text-zinc-600 dark:text-zinc-400">
                  {issue.assignee ? (
                    <span className="inline-flex items-center gap-1 font-medium text-zinc-800 dark:text-zinc-200">
                      <User className="h-3 w-3 text-zinc-400" />
                      {issue.assignee.name ?? issue.assignee.email}
                    </span>
                  ) : (
                    <span className="text-zinc-400 italic">Unassigned</span>
                  )}
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-xs text-zinc-500 font-mono">
                  {issue.lastSeenAt.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
              </tr>
            ))}
            {!issues.length && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-zinc-500"
                >
                  <ShieldAlert className="mx-auto h-8 w-8 text-zinc-400 opacity-60" />
                  <p className="mt-2 font-medium text-zinc-800 dark:text-zinc-200">
                    No findings match these filters
                  </p>
                  <p className="mt-0.5 text-xs">
                    Try adjusting your search criteria or clearing filters.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (< lg screens - no horizontal scroll needed!) */}
      <div className="lg:hidden space-y-3">
        {issues.map((issue) => (
          <Link
            key={issue.id}
            href={`/issues/${issue.id}`}
            className="block rounded-xl border border-zinc-200 bg-card p-4 transition-all hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 shadow-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant={issue.severity} dot>
                  <span className="capitalize">{issue.severity}</span>
                </Badge>
                <Badge variant={issue.status}>
                  <span className="capitalize">{label(issue.status)}</span>
                </Badge>
              </div>
              <time className="text-[11px] font-mono text-zinc-400">
                {issue.lastSeenAt.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </div>

            <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2">
              {issue.title}
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2.5 text-xs text-zinc-500 dark:border-zinc-800">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {issue.service.application.name} / {issue.service.name}
                </span>
                <span className="rounded bg-zinc-100 px-1.5 py-0.2 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 font-mono">
                  {issue.tool.name}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {issue.assignee ? (
                  <span className="text-zinc-700 dark:text-zinc-300 text-[11px]">
                    {issue.assignee.name ?? issue.assignee.email}
                  </span>
                ) : (
                  <span className="italic text-zinc-400 text-[11px]">
                    Unassigned
                  </span>
                )}
                <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
              </div>
            </div>
          </Link>
        ))}

        {!issues.length && (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            <ShieldAlert className="mx-auto h-8 w-8 text-zinc-400 opacity-60" />
            <p className="mt-2 font-medium text-zinc-800 dark:text-zinc-200">
              No findings match your filter
            </p>
            <p className="mt-0.5 text-xs">
              Clear filters or modify your search term.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Filter({
  name,
  label,
  value,
  children,
}: {
  name: string;
  label: string;
  value: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="text-xs">
      <span className="mb-1 block font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <select name={name} defaultValue={value ?? ""} className={selectClass}>
        <option value="">All {label}s</option>
        {children}
      </select>
    </label>
  );
}
