import type { Prisma } from "@/generated/prisma/client";
import { effectiveToolConfig } from "@/lib/catalog";
import {
  filterPlannedToolKeys,
  parseProbe,
  readBoundedJson,
} from "@/lib/ci/pipeline";
import { prisma } from "@/lib/db";
import { authenticateServiceBearer } from "@/lib/service-token";
import { toolRegistry } from "@/lib/tools";

export async function POST(request: Request) {
  const service = await authenticateServiceBearer(
    request.headers.get("authorization"),
  );
  if (!service) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const probe = parseProbe(await readBoundedJson(request, 16 * 1024));
    const registeredKeys = toolRegistry.values().map(({ key }) => key);
    const tools = await prisma.tool.findMany({
      where: { key: { in: registeredKeys } },
      select: {
        id: true,
        key: true,
        name: true,
        appToolConfigs: {
          where: { applicationId: service.applicationId },
          select: { toolId: true, enabled: true },
        },
        serviceToolConfigs: {
          where: { serviceId: service.id },
          select: { toolId: true, enabled: true },
        },
      },
    });
    const effective = effectiveToolConfig(
      tools.map(({ id, key, name }) => ({ id, key, name })),
      tools.flatMap(({ appToolConfigs }) => appToolConfigs),
      tools.flatMap(({ serviceToolConfigs }) => serviceToolConfigs),
    );
    const plannedKeys = filterPlannedToolKeys(
      registeredKeys,
      effective,
      probe.availableTools,
    );
    const scan = await prisma.scan.create({
      data: {
        serviceId: service.id,
        metadata: {
          availableTools: probe.availableTools,
          plannedTools: plannedKeys,
        } satisfies Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    const plan = { scanId: scan.id, tools: plannedKeys };

    return request.headers.get("accept")?.includes("text/plain")
      ? new Response(`${scan.id}\n${plannedKeys.join("\n")}\n`, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        })
      : Response.json(plan, {
          headers: { "Cache-Control": "no-store" },
        });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid probe" },
      { status: 400 },
    );
  }
}
