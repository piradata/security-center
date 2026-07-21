import {
  type IssueSeverity,
  IssueStatus,
  type IssueStatus as Status,
} from "@/generated/prisma/enums";

export type Finding = {
  fingerprint: string;
  title: string;
  description?: string | null;
  severity: IssueSeverity;
  raw?: unknown;
};

export type ExistingIssue = {
  id: string;
  toolId: string;
  fingerprint: string;
  status: Status;
};

export function buildReconciliationPlan(
  existing: readonly ExistingIssue[],
  toolId: string,
  findings: readonly Finding[],
  seenAt: Date,
) {
  const scoped = existing.filter((issue) => issue.toolId === toolId);
  const byFingerprint = new Map(
    existing.map((issue) => [issue.fingerprint, issue]),
  );
  const uniqueFindings = new Map<string, Finding>();

  for (const finding of findings) {
    if (!finding.fingerprint.trim() || !finding.title.trim()) {
      throw new TypeError("Findings require a fingerprint and title");
    }
    uniqueFindings.set(finding.fingerprint, finding);
  }

  const seen = [...uniqueFindings.values()].map((finding) => {
    const issue = byFingerprint.get(finding.fingerprint);
    const regressed =
      issue?.status === IssueStatus.resolved ||
      issue?.status === IssueStatus.absent;

    return {
      issueId: issue?.id,
      finding,
      status: regressed
        ? IssueStatus.open
        : (issue?.status ?? IssueStatus.open),
      regressionAt: regressed ? seenAt : undefined,
    };
  });

  const seenFingerprints = new Set(uniqueFindings.keys());
  const absentIds = scoped
    .filter(
      ({ fingerprint, status }) =>
        !seenFingerprints.has(fingerprint) &&
        (status === IssueStatus.open || status === IssueStatus.in_progress),
    )
    .map(({ id }) => id);

  return { seen, absentIds };
}
