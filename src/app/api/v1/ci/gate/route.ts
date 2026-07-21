import {
  IssueSeverity,
  IssueStatus,
  type Prisma,
  ScanStatus,
} from "@/generated/prisma/client";
import { evaluateGate } from "@/lib/ci/pipeline";
import { prisma } from "@/lib/db";
import { authenticateServiceBearer } from "@/lib/service-token";

export async function GET(request: Request) {
  const service = await authenticateServiceBearer(
    request.headers.get("authorization"),
  );
  if (!service) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scanId = new URL(request.url).searchParams.get("scanId");
  if (!scanId || !/^[A-Za-z0-9_-]{1,64}$/.test(scanId)) {
    return Response.json({ error: "scanId is invalid" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const scan = await tx.scan.findFirst({
      where: { id: scanId, serviceId: service.id },
      select: {
        id: true,
        status: true,
        startedAt: true,
        metadata: true,
        service: { select: { score: true } },
      },
    });
    if (!scan) return { kind: "missing" as const };
    if (scan.status === ScanStatus.failed) return { kind: "failed" as const };

    const configuredGates = await tx.qualityGate.findMany({
      where: { applicationId: service.applicationId },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      select: {
        name: true,
        scoreThreshold: true,
        failOnNewHighCritical: true,
      },
    });
    const gate = configuredGates.find(({ name }) => name === "default") ??
      configuredGates[0] ?? {
        name: "default",
        scoreThreshold: null,
        failOnNewHighCritical: true,
      };
    const issues = await tx.issue.findMany({
      where: {
        scanId: scan.id,
        status: IssueStatus.open,
        severity: { in: [IssueSeverity.high, IssueSeverity.critical] },
      },
      select: { severity: true, firstSeenAt: true, regressionAt: true },
    });
    const score = scan.service.score ?? 100;
    const evaluation = evaluateGate(
      gate,
      score,
      issues.map(({ severity, firstSeenAt, regressionAt }) => ({
        severity,
        isNewOrReopened:
          firstSeenAt >= scan.startedAt ||
          (regressionAt !== null && regressionAt >= scan.startedAt),
      })),
    );
    const previousMetadata =
      scan.metadata &&
      typeof scan.metadata === "object" &&
      !Array.isArray(scan.metadata)
        ? (scan.metadata as Prisma.JsonObject)
        : {};
    const response = {
      scanId: scan.id,
      passed: evaluation.passed,
      score,
      gate: {
        name: gate.name,
        scoreThreshold: gate.scoreThreshold,
        failOnNewHighCritical: gate.failOnNewHighCritical,
      },
      newHighCritical: evaluation.newHighCritical,
      reasons: evaluation.reasons,
    };

    await tx.scan.update({
      where: { id: scan.id },
      data: {
        status: ScanStatus.completed,
        finishedAt: new Date(),
        passedGate: evaluation.passed,
        score,
        metadata: {
          ...previousMetadata,
          gateResult: response,
        } as Prisma.InputJsonValue,
      },
    });
    return { kind: "result" as const, response };
  });

  if (result.kind === "missing") {
    return Response.json({ error: "Scan not found" }, { status: 404 });
  }
  if (result.kind === "failed") {
    return Response.json({ error: "Scan ingestion failed" }, { status: 409 });
  }
  return Response.json(result.response, {
    status: result.response.passed ? 200 : 422,
    headers: { "Cache-Control": "no-store" },
  });
}
