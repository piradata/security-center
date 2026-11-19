import assert from "node:assert/strict";
import test from "node:test";
import { IssueSeverity, IssueStatus } from "@/generated/prisma/enums";
import { issueWhere } from "./issues-query";

test("issueWhere builds filters correctly", () => {
  const emptyParams = new URLSearchParams();
  assert.deepEqual(issueWhere(emptyParams), {});

  const searchParams = new URLSearchParams({ q: "CVE-2024-1234" });
  assert.deepEqual(issueWhere(searchParams), {
    OR: [
      { title: { contains: "CVE-2024-1234", mode: "insensitive" } },
      { fingerprint: { contains: "CVE-2024-1234", mode: "insensitive" } },
      { description: { contains: "CVE-2024-1234", mode: "insensitive" } },
    ],
  });

  const filterParams = new URLSearchParams({
    appId: "app-1",
    serviceId: "svc-1",
    toolId: "tool-1",
    severity: IssueSeverity.critical,
    status: IssueStatus.open,
    unassigned: "true",
  });

  assert.deepEqual(issueWhere(filterParams), {
    service: { applicationId: "app-1" },
    serviceId: "svc-1",
    toolId: "tool-1",
    severity: IssueSeverity.critical,
    status: IssueStatus.open,
    assigneeUserId: null,
  });

  const assignedParams = new URLSearchParams({
    assigneeUserId: "user-123",
  });
  assert.deepEqual(issueWhere(assignedParams), {
    assigneeUserId: "user-123",
  });
});
