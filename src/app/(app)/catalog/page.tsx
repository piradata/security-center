import { Key, Layers, Percent, Server } from "lucide-react";
import { redirect } from "next/navigation";
import { StatCard } from "@/components/ui/stat-card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CatalogView } from "./catalog-view";

export default async function CatalogPage() {
  if (!(await auth())?.user) redirect("/login");

  const [applications, tools] = await Promise.all([
    prisma.application.findMany({
      orderBy: { name: "asc" },
      include: {
        appToolConfigs: true,
        services: {
          orderBy: { name: "asc" },
          include: {
            serviceToolConfigs: true,
            scans: {
              where: { coverageLine: { not: null } },
              orderBy: { startedAt: "desc" },
              take: 1,
              select: {
                coverageLine: true,
                coverageBranch: true,
                coverageFunction: true,
                coverageSource: true,
              },
            },
          },
        },
      },
    }),
    prisma.tool.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Compute catalogue overview statistics
  const totalApplications = applications.length;
  let totalServices = 0;
  let tokenedServices = 0;
  let totalCoverage = 0;
  let coverageCount = 0;

  for (const app of applications) {
    for (const svc of app.services) {
      totalServices += 1;
      if (svc.tokenHash) tokenedServices += 1;
      if (
        svc.scans[0]?.coverageLine !== null &&
        svc.scans[0]?.coverageLine !== undefined
      ) {
        totalCoverage += svc.scans[0].coverageLine;
        coverageCount += 1;
      }
    }
  }

  const avgCoverage =
    coverageCount > 0 ? Math.round(totalCoverage / coverageCount) : null;
  const tokenCoveragePercent =
    totalServices > 0 ? Math.round((tokenedServices / totalServices) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          Software Catalogue
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Developer service directory, ownership mappings, pipeline credentials,
          and scanner configuration.
        </p>
      </div>

      {/* Catalogue Metrics Header */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Applications"
          value={totalApplications}
          subtext="Logical domain groups"
          icon={Layers}
        />
        <StatCard
          title="Total Services"
          value={totalServices}
          subtext="Catalogued microservices"
          icon={Server}
        />
        <StatCard
          title="CI Connected"
          value={`${tokenCoveragePercent}%`}
          subtext={`${tokenedServices} of ${totalServices} have active CI tokens`}
          icon={Key}
          tone={tokenCoveragePercent >= 80 ? "good" : "warn"}
        />
        <StatCard
          title="Avg Line Coverage"
          value={avgCoverage !== null ? `${avgCoverage}%` : "—"}
          subtext={
            coverageCount > 0
              ? `Reported across ${coverageCount} services`
              : "No coverage uploads yet"
          }
          icon={Percent}
          tone="info"
        />
      </div>

      {/* Interactive Catalogue View (Search, Filters, Application & Service Cards) */}
      <CatalogView applications={applications} tools={tools} />
    </div>
  );
}
