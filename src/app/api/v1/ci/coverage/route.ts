import { ScanStatus } from "@/generated/prisma/client";
import { parseCoverageInput } from "@/lib/coverage";
import { prisma } from "@/lib/db";
import { authenticateServiceBearer } from "@/lib/service-token";

export async function POST(request: Request) {
  const service = await authenticateServiceBearer(
    request.headers.get("authorization"),
  );
  if (!service) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseCoverageInput(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const { line, branch, function: fn, source } = parsed.value;
  const coverageAt = new Date();

  const latest = await prisma.scan.findFirst({
    where: { serviceId: service.id },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });

  const scan = latest
    ? await prisma.scan.update({
        where: { id: latest.id },
        data: {
          coverageLine: line,
          coverageBranch: branch,
          coverageFunction: fn,
          coverageSource: source,
          coverageAt,
        },
        select: { id: true },
      })
    : await prisma.scan.create({
        data: {
          serviceId: service.id,
          status: ScanStatus.completed,
          coverageLine: line,
          coverageBranch: branch,
          coverageFunction: fn,
          coverageSource: source,
          coverageAt,
        },
        select: { id: true },
      });

  return Response.json({
    scanId: scan.id,
    line,
    branch,
    function: fn,
    source,
    coverageAt: coverageAt.toISOString(),
  });
}
