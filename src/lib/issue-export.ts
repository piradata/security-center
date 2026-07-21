import { isAbsolute, relative, resolve } from "node:path";
import {
  ExportFormat,
  type ExportFormat as Format,
  IssueSeverity,
  IssueStatus,
  type IssueSeverity as Severity,
  type IssueStatus as Status,
} from "../generated/prisma/enums";

export type IssueExportFilters = {
  appId?: string;
  serviceId?: string;
  toolId?: string;
  severity?: Severity;
  status?: Status;
  assigneeUserId?: string;
  unassigned?: boolean;
};

export type IssueExportPayload = {
  format: Format;
  filters: IssueExportFilters;
};

export type IssueExportRow = {
  id: string;
  application: string;
  service: string;
  tool: string;
  severity: string;
  status: string;
  assignee: string;
  title: string;
  description: string;
  fingerprint: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

const ID_FILTERS = ["appId", "serviceId", "toolId", "assigneeUserId"] as const;
const CSV_COLUMNS = [
  "id",
  "application",
  "service",
  "tool",
  "severity",
  "status",
  "assignee",
  "title",
  "description",
  "fingerprint",
  "firstSeenAt",
  "lastSeenAt",
] as const;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid export payload");
  }
  return value as Record<string, unknown>;
}

export function parseIssueExportPayload(value: unknown): IssueExportPayload {
  const input = record(value);
  if (!Object.values(ExportFormat).includes(input.format as Format)) {
    throw new Error("Format must be csv or json");
  }

  const rawFilters = input.filters === undefined ? {} : record(input.filters);
  const filters: IssueExportFilters = {};
  for (const key of ID_FILTERS) {
    const filter = rawFilters[key];
    if (filter === undefined || filter === "") continue;
    if (typeof filter !== "string" || filter.length > 100) {
      throw new Error(`Invalid ${key} filter`);
    }
    filters[key] = filter;
  }

  if (rawFilters.severity !== undefined) {
    if (
      !Object.values(IssueSeverity).includes(rawFilters.severity as Severity)
    ) {
      throw new Error("Invalid severity filter");
    }
    filters.severity = rawFilters.severity as Severity;
  }
  if (rawFilters.status !== undefined) {
    if (!Object.values(IssueStatus).includes(rawFilters.status as Status)) {
      throw new Error("Invalid status filter");
    }
    filters.status = rawFilters.status as Status;
  }
  if (rawFilters.unassigned !== undefined) {
    if (typeof rawFilters.unassigned !== "boolean") {
      throw new Error("Invalid unassigned filter");
    }
    filters.unassigned = rawFilters.unassigned;
    if (filters.unassigned) delete filters.assigneeUserId;
  }

  return { format: input.format as Format, filters };
}

export function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeIssueExport(
  format: Format,
  rows: IssueExportRow[],
): string {
  const records = rows.map((row) => ({
    ...row,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
  }));
  if (format === ExportFormat.json)
    return `${JSON.stringify(records, null, 2)}\n`;

  return (
    [
      CSV_COLUMNS.join(","),
      ...records.map((row) =>
        CSV_COLUMNS.map((column) => csvEscape(row[column])).join(","),
      ),
    ].join("\r\n") + "\r\n"
  );
}

export function exportFilename(jobId: string, format: Format): string {
  if (!/^[A-Za-z0-9_-]+$/.test(jobId)) throw new Error("Invalid export job id");
  return `issues-${jobId}.${format}`;
}

export function resolveExportPath(
  storagePath: string,
  filename: string,
): string {
  if (!/^issues-[A-Za-z0-9_-]+\.(csv|json)$/.test(filename)) {
    throw new Error("Invalid export filename");
  }
  const root = resolve(storagePath);
  const file = resolve(root, filename);
  const pathFromRoot = relative(root, file);
  if (
    !pathFromRoot ||
    pathFromRoot.startsWith("..") ||
    isAbsolute(pathFromRoot)
  ) {
    throw new Error("Export path escapes storage");
  }
  return file;
}

export function retryStatus(attempts: number, maxAttempts: number) {
  return attempts < maxAttempts ? "pending" : "failed";
}
