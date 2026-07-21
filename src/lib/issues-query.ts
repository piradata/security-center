import type { Prisma } from "@/generated/prisma/client";
import {
  IssueSeverity,
  IssueStatus,
  type IssueSeverity as Severity,
  type IssueStatus as Status,
} from "@/generated/prisma/enums";

export function issueWhere(params: Pick<URLSearchParams, "get">) {
  const severity = params.get("severity");
  const status = params.get("status");
  const where: Prisma.IssueWhereInput = {};

  if (params.get("appId")) {
    where.service = { applicationId: params.get("appId")! };
  }
  if (params.get("serviceId")) where.serviceId = params.get("serviceId")!;
  if (params.get("toolId")) where.toolId = params.get("toolId")!;
  if (Object.values(IssueSeverity).includes(severity as Severity)) {
    where.severity = severity as Severity;
  }
  if (Object.values(IssueStatus).includes(status as Status)) {
    where.status = status as Status;
  }
  if (params.get("unassigned") === "true") {
    where.assigneeUserId = null;
  } else if (params.get("assigneeUserId")) {
    where.assigneeUserId = params.get("assigneeUserId")!;
  }

  return where;
}
