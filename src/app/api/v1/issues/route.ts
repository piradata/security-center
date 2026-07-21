import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { issueWhere } from "@/lib/issues-query";

export async function GET(request: Request) {
  if (!(await auth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const issues = await prisma.issue.findMany({
    where: issueWhere(new URL(request.url).searchParams),
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      tool: { select: { id: true, key: true, name: true } },
      service: {
        select: {
          id: true,
          name: true,
          application: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { lastSeenAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ issues });
}
