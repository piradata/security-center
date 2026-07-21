import Link from "next/link";
import { redirect } from "next/navigation";
import { IssueSeverity, IssueStatus } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { issueWhere } from "@/lib/issues-query";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const input =
  "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";

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

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-semibold tracking-tight">Issues</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Findings reconciled from completed scanner results.
      </p>

      <form className="mt-6 grid gap-3 rounded-lg border border-zinc-200 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-zinc-800">
        <Filter name="appId" label="Application" value={params.get("appId")}>
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
        <Filter name="severity" label="Severity" value={params.get("severity")}>
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
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="unassigned"
            value="true"
            defaultChecked={params.get("unassigned") === "true"}
            className="size-4"
          />
          Unassigned only
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Filter
          </button>
          <Link
            href="/issues"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            Clear
          </Link>
        </div>
      </form>

      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3">Issue</th>
              <th className="px-4 py-3">Application / service</th>
              <th className="px-4 py-3">Tool</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assignee</th>
              <th className="px-4 py-3">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {issues.map((issue) => (
              <tr key={issue.id}>
                <td className="max-w-md px-4 py-3">
                  <Link
                    href={`/issues/${issue.id}`}
                    className="font-medium hover:underline"
                  >
                    {issue.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {issue.service.application.name} / {issue.service.name}
                </td>
                <td className="px-4 py-3">{issue.tool.name}</td>
                <td className="px-4 py-3 capitalize">{issue.severity}</td>
                <td className="px-4 py-3 capitalize">{label(issue.status)}</td>
                <td className="px-4 py-3">
                  {issue.assignee?.name ??
                    issue.assignee?.email ??
                    "Unassigned"}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {issue.lastSeenAt.toLocaleString()}
                </td>
              </tr>
            ))}
            {!issues.length && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-zinc-500"
                >
                  No issues match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
    <label className="text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <select name={name} defaultValue={value ?? ""} className={input}>
        <option value="">All</option>
        {children}
      </select>
    </label>
  );
}
