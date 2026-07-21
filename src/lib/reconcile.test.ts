import assert from "node:assert/strict";
import test from "node:test";
import { IssueSeverity, IssueStatus } from "@/generated/prisma/enums";
import { buildReconciliationPlan } from "@/lib/reconcile-state";

const now = new Date("2026-07-21T12:00:00.000Z");
const finding = {
  fingerprint: "npm:CVE-1",
  title: "Vulnerable dependency",
  severity: IssueSeverity.high,
};

test("updates the same issue and deduplicates repeated findings", () => {
  const plan = buildReconciliationPlan(
    [
      {
        id: "issue-1",
        toolId: "npm",
        fingerprint: finding.fingerprint,
        status: IssueStatus.open,
      },
    ],
    "npm",
    [finding, { ...finding, title: "Latest title" }],
    now,
  );

  assert.equal(plan.seen.length, 1);
  assert.equal(plan.seen[0].issueId, "issue-1");
  assert.equal(plan.seen[0].finding.title, "Latest title");
});

test("marks missing open and in-progress issues absent", () => {
  const plan = buildReconciliationPlan(
    [
      {
        id: "open",
        toolId: "npm",
        fingerprint: "a",
        status: IssueStatus.open,
      },
      {
        id: "working",
        toolId: "npm",
        fingerprint: "b",
        status: IssueStatus.in_progress,
      },
    ],
    "npm",
    [],
    now,
  );

  assert.deepEqual(plan.absentIds, ["open", "working"]);
});

test("reopens resolved and absent issues as regressions", () => {
  for (const status of [IssueStatus.resolved, IssueStatus.absent]) {
    const plan = buildReconciliationPlan(
      [
        {
          id: status,
          toolId: "npm",
          fingerprint: finding.fingerprint,
          status,
        },
      ],
      "npm",
      [finding],
      now,
    );

    assert.equal(plan.seen[0].status, IssueStatus.open);
    assert.equal(plan.seen[0].regressionAt, now);
  }
});

test("never changes suppressed issues automatically", () => {
  const existing = {
    id: "suppressed",
    toolId: "npm",
    fingerprint: finding.fingerprint,
    status: IssueStatus.suppressed,
  };

  const present = buildReconciliationPlan([existing], "npm", [finding], now);
  const missing = buildReconciliationPlan([existing], "npm", [], now);

  assert.equal(present.seen[0].status, IssueStatus.suppressed);
  assert.equal(present.seen[0].regressionAt, undefined);
  assert.deepEqual(missing.absentIds, []);
});

test("does not mark another tool's issues absent", () => {
  const plan = buildReconciliationPlan(
    [
      {
        id: "npm-issue",
        toolId: "npm",
        fingerprint: "npm:a",
        status: IssueStatus.open,
      },
      {
        id: "semgrep-issue",
        toolId: "semgrep",
        fingerprint: "semgrep:a",
        status: IssueStatus.open,
      },
    ],
    "npm",
    [],
    now,
  );

  assert.deepEqual(plan.absentIds, ["npm-issue"]);
});
