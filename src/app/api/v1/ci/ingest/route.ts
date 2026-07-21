import { ScanStatus } from "@/generated/prisma/client";
import { parseIngestPayload, readBoundedJson } from "@/lib/ci/pipeline";
import { prisma } from "@/lib/db";
import { reconcileToolResult } from "@/lib/reconcile";
import { authenticateServiceBearer } from "@/lib/service-token";
import { toolRegistry } from "@/lib/tools";

export async function POST(request: Request) {
  const service = await authenticateServiceBearer(
    request.headers.get("authorization"),
  );
  if (!service) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let activeScanId: string | undefined;
  try {
    const payload = parseIngestPayload(
      await readBoundedJson(request, 5 * 1024 * 1024),
    );
    const adapter = toolRegistry.get(payload.tool);
    if (!adapter) throw new TypeError("tool is not registered");

    const tool = await prisma.tool.findUnique({
      where: { key: payload.tool },
      select: {
        id: true,
        appToolConfigs: {
          where: { applicationId: service.applicationId },
          select: { enabled: true },
        },
        serviceToolConfigs: {
          where: { serviceId: service.id },
          select: { enabled: true },
        },
      },
    });
    if (!tool) throw new TypeError("tool is not registered");
    const enabled =
      tool.serviceToolConfigs[0]?.enabled ??
      tool.appToolConfigs[0]?.enabled ??
      true;
    if (!enabled) {
      return Response.json({ error: "Tool is disabled" }, { status: 409 });
    }

    const scan = payload.scanId
      ? await prisma.scan.findFirst({
          where: { id: payload.scanId, serviceId: service.id },
          select: { id: true },
        })
      : await prisma.scan.create({
          data: { serviceId: service.id },
          select: { id: true },
        });
    if (!scan) {
      return Response.json({ error: "Scan not found" }, { status: 404 });
    }
    activeScanId = scan.id;

    const findings = adapter.normalize(payload.result);
    if (
      findings.length > 10_000 ||
      findings.some(
        ({ fingerprint, title, description }) =>
          fingerprint.length > 200 ||
          title.length > 1_000 ||
          (description?.length ?? 0) > 20_000,
      )
    ) {
      throw new TypeError("Scanner result exceeds finding limits");
    }

    const reconciliation = await reconcileToolResult({
      serviceId: service.id,
      toolId: tool.id,
      scanId: scan.id,
      findings,
    });
    await prisma.scan.update({
      where: { id: scan.id },
      data: { status: ScanStatus.running, finishedAt: null },
    });

    return Response.json({
      scanId: scan.id,
      tool: payload.tool,
      findings: findings.length,
      reconciliation,
    });
  } catch (error) {
    if (activeScanId) {
      await prisma.scan
        .update({
          where: { id: activeScanId },
          data: { status: ScanStatus.failed, finishedAt: new Date() },
        })
        .catch(() => undefined);
    }
    const invalid = error instanceof TypeError;
    return Response.json(
      { error: invalid ? error.message : "Could not ingest scanner result" },
      { status: invalid ? 400 : 500 },
    );
  }
}
