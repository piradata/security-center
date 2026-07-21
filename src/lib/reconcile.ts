import { Prisma, IssueStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { refreshScores } from "@/lib/scoring";
import {
  buildReconciliationPlan,
  type Finding,
} from "@/lib/reconcile-state";

type ReconcileToolResult = {
  serviceId: string;
  toolId: string;
  scanId: string;
  findings: readonly Finding[];
  completedAt?: Date;
};

function jsonValue(value: unknown) {
  if (value === undefined) return undefined;
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

export async function reconcileToolResult({
  serviceId,
  toolId,
  scanId,
  findings,
  completedAt = new Date(),
}: ReconcileToolResult) {
  return prisma.$transaction(async (tx) => {
    const [scan, tool, existing] = await Promise.all([
      tx.scan.findUnique({
        where: { id: scanId },
        select: { serviceId: true },
      }),
      tx.tool.findUnique({ where: { id: toolId }, select: { id: true } }),
      tx.issue.findMany({
        where: { serviceId },
        select: { id: true, toolId: true, fingerprint: true, status: true },
      }),
    ]);

    if (!scan || scan.serviceId !== serviceId) {
      throw new TypeError("Scan does not belong to the service");
    }
    if (!tool) throw new TypeError("Unknown tool");

    const plan = buildReconciliationPlan(
      existing,
      toolId,
      findings,
      completedAt,
    );

    if (plan.absentIds.length) {
      await tx.issue.updateMany({
        where: {
          id: { in: plan.absentIds },
          status: { in: [IssueStatus.open, IssueStatus.in_progress] },
        },
        data: { status: IssueStatus.absent },
      });
    }

    for (const item of plan.seen) {
      const data = {
        scanId,
        title: item.finding.title,
        description: item.finding.description,
        severity: item.finding.severity,
        raw: jsonValue(item.finding.raw),
        lastSeenAt: completedAt,
        status: item.status,
        regressionAt: item.regressionAt,
      };

      if (item.issueId) {
        await tx.issue.update({ where: { id: item.issueId }, data });
      } else {
        await tx.issue.create({
          data: {
            ...data,
            serviceId,
            toolId,
            fingerprint: item.finding.fingerprint,
            firstSeenAt: completedAt,
          },
        });
      }
    }

    await refreshScores(tx, serviceId);

    return {
      created: plan.seen.filter(({ issueId }) => !issueId).length,
      updated: plan.seen.filter(({ issueId }) => issueId).length,
      absent: plan.absentIds.length,
      regressions: plan.seen.filter(({ regressionAt }) => regressionAt).length,
    };
  });
}

export type { Finding };
