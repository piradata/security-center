import assert from "node:assert/strict";
import { test } from "node:test";
import {
  csvEscape,
  exportFilename,
  type IssueExportRow,
  resolveExportPath,
  retryStatus,
  serializeIssueExport,
} from "./issue-export";

const row: IssueExportRow = {
  id: "issue-1",
  application: "Checkout",
  service: "API",
  tool: "semgrep",
  severity: "high",
  status: "open",
  assignee: "Ada",
  title: 'Comma, quote " and newline\n',
  description: "",
  fingerprint: "abc",
  firstSeenAt: new Date("2026-07-21T10:00:00.000Z"),
  lastSeenAt: new Date("2026-07-21T11:00:00.000Z"),
};

test("CSV escaping preserves commas, quotes, and newlines", () => {
  assert.equal(csvEscape(row.title), '"Comma, quote "" and newline\n"');
  const csv = serializeIssueExport("csv", [row]);
  assert.match(csv, /"Comma, quote "" and newline\n"/);
  assert.ok(csv.endsWith("\r\n"));
});

test("JSON export serializes dates as ISO strings", () => {
  const parsed = JSON.parse(serializeIssueExport("json", [row]));
  assert.equal(parsed[0].firstSeenAt, "2026-07-21T10:00:00.000Z");
  assert.equal(parsed[0].title, row.title);
});

test("export paths cannot leave storage", () => {
  assert.equal(exportFilename("job_123", "csv"), "issues-job_123.csv");
  assert.equal(
    resolveExportPath("/var/exports", "issues-job_123.csv"),
    "/var/exports/issues-job_123.csv",
  );
  assert.throws(() => resolveExportPath("/var/exports", "../secrets.json"));
  assert.throws(() => resolveExportPath("/var/exports", "/etc/passwd"));
});

test("retry state is bounded by max attempts", () => {
  assert.equal(retryStatus(2, 3), "pending");
  assert.equal(retryStatus(3, 3), "failed");
});
