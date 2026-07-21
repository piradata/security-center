import {
  IssueSeverity,
  IssueStatus,
  type IssueSeverity as Severity,
  type IssueStatus as Status,
} from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export const SEVERITY_WEIGHTS = {
  [IssueSeverity.critical]: 40,
  [IssueSeverity.high]: 20,
  [IssueSeverity.medium]: 10,
  [IssueSeverity.low]: 5,
  [IssueSeverity.info]: 1,
} satisfies Record<Severity, number>;

export function serviceScore(
  issues: readonly { severity: Severity; status: Status }[],
): number {
  const penalty = issues
    .filter(
      ({ status }) =>
        status === IssueStatus.open || status === IssueStatus.in_progress,
    )
    .reduce((sum, { severity }) => sum + SEVERITY_WEIGHTS[severity], 0);

  return Math.max(0, 100 - penalty);
}

export function applicationScore(serviceScores: readonly number[]): number {
  return serviceScores.length ? Math.min(...serviceScores) : 100;
}

export async function refreshScores(
  tx: Prisma.TransactionClient,
  serviceId: string,
) {
  const service = await tx.service.findUniqueOrThrow({
    where: { id: serviceId },
    select: { applicationId: true },
  });
  const services = await tx.service.findMany({
    where: { applicationId: service.applicationId },
    select: {
      id: true,
      issues: {
        where: {
          status: { in: [IssueStatus.open, IssueStatus.in_progress] },
        },
        select: { severity: true, status: true },
      },
    },
  });
  const scores = services.map(({ id, issues }) => ({
    id,
    score: serviceScore(issues),
  }));

  await Promise.all([
    ...scores.map(({ id, score }) =>
      tx.service.update({ where: { id }, data: { score } }),
    ),
    tx.application.update({
      where: { id: service.applicationId },
      data: { score: applicationScore(scores.map(({ score }) => score)) },
    }),
  ]);
}
