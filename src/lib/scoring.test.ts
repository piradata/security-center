import assert from "node:assert/strict";
import test from "node:test";
import { IssueSeverity, IssueStatus } from "@/generated/prisma/enums";
import {
  applicationScore,
  serviceScore,
  SEVERITY_WEIGHTS,
} from "@/lib/scoring";

test("service score uses fixed weights for open and in-progress issues only", () => {
  assert.equal(
    serviceScore([
      { severity: IssueSeverity.critical, status: IssueStatus.open },
      { severity: IssueSeverity.high, status: IssueStatus.in_progress },
      { severity: IssueSeverity.medium, status: IssueStatus.resolved },
      { severity: IssueSeverity.low, status: IssueStatus.absent },
      { severity: IssueSeverity.info, status: IssueStatus.suppressed },
    ]),
    100 -
      SEVERITY_WEIGHTS.critical -
      SEVERITY_WEIGHTS.high,
  );
});

test("service score bottoms at zero", () => {
  assert.equal(
    serviceScore(
      Array.from({ length: 3 }, () => ({
        severity: IssueSeverity.critical,
        status: IssueStatus.open,
      })),
    ),
    0,
  );
});

test("application score is the minimum service score", () => {
  assert.equal(applicationScore([95, 70, 85]), 70);
  assert.equal(applicationScore([]), 100);
});
