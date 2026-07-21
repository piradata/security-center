import { NextResponse } from "next/server";
import { Prisma, IssueStatus } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { refreshScores } from "@/lib/scoring";

type Context = { params: Promise<{ id: string }> };

const include = {
  assignee: { select: { id: true, name: true, email: true } },
  tool: { select: { id: true, key: true, name: true } },
  service: {
    select: {
      id: true,
      name: true,
      application: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.IssueInclude;

export async function GET(_request: Request, { params }: Context) {
  if (!(await auth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const issue = await prisma.issue.findUnique({
    where: { id: (await params).id },
    include,
  });

  return issue
    ? NextResponse.json({ issue })
    : NextResponse.json({ error: "Issue not found" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: Context) {
  if (!(await auth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const hasAssignee = Object.hasOwn(body, "assigneeUserId");
  const status = (body as { status?: unknown }).status;
  const assigneeUserId = (body as { assigneeUserId?: unknown }).assigneeUserId;

  if (
    status !== undefined &&
    !Object.values(IssueStatus).includes(status as IssueStatus)
  ) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (
    hasAssignee &&
    assigneeUserId !== null &&
    typeof assigneeUserId !== "string"
  ) {
    return NextResponse.json({ error: "Invalid assigneeUserId" }, { status: 400 });
  }
  if (status === undefined && !hasAssignee) {
    return NextResponse.json({ error: "No changes supplied" }, { status: 400 });
  }

  const id = (await params).id;
  const issue = await prisma.$transaction(async (tx) => {
    const current = await tx.issue.findUnique({
      where: { id },
      select: { serviceId: true },
    });
    if (!current) return null;

    if (
      typeof assigneeUserId === "string" &&
      !(await tx.user.findUnique({
        where: { id: assigneeUserId },
        select: { id: true },
      }))
    ) {
      return "unknown-assignee" as const;
    }

    const updated = await tx.issue.update({
      where: { id },
      data: {
        status: status as IssueStatus | undefined,
        assigneeUserId: hasAssignee
          ? (assigneeUserId as string | null)
          : undefined,
      },
      include,
    });
    await refreshScores(tx, current.serviceId);
    return updated;
  });

  if (issue === "unknown-assignee") {
    return NextResponse.json({ error: "Unknown assignee" }, { status: 400 });
  }
  return issue
    ? NextResponse.json({ issue })
    : NextResponse.json({ error: "Issue not found" }, { status: 404 });
}
