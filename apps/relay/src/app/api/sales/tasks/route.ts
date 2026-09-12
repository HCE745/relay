export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSalesSession } from "@/lib/sales-auth";
import { prisma } from "@/lib/prisma";

const taskIncludes = {
  assignedTo: { select: { id: true, name: true } },
  opportunity: { select: { id: true, title: true } },
  prospect: { select: { id: true, companyName: true } },
  demoCall: { select: { id: true, contactName: true, companyName: true } },
};

export async function GET(req: NextRequest) {
  const info = await getSalesSession();
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const opportunityId = searchParams.get("opportunityId") ?? undefined;
  const prospectId = searchParams.get("prospectId") ?? undefined;

  const where: Record<string, unknown> = {};

  if (info.isRep) {
    where.assignedToId = info.salesUserId;
  } else {
    const assignedToId = searchParams.get("assignedToId");
    if (assignedToId) where.assignedToId = assignedToId;
  }

  if (opportunityId) where.opportunityId = opportunityId;
  if (prospectId) where.prospectId = prospectId;

  const tasks = await prisma.crmTask.findMany({
    where,
    include: taskIncludes,
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const info = await getSalesSession();
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    title,
    taskType,
    dueAt,
    notes,
    priority,
    opportunityId,
    prospectId,
    demoCallId,
    assignedToId: bodyAssignedToId,
  } = body;

  let assignedToId = bodyAssignedToId ?? info.salesUserId;

  if (info.isRep && assignedToId !== info.salesUserId) {
    return NextResponse.json({ error: "Reps can only create tasks assigned to themselves" }, { status: 403 });
  }

  const task = await prisma.crmTask.create({
    data: {
      title,
      taskType,
      dueAt: dueAt ? new Date(dueAt) : undefined,
      notes,
      priority,
      opportunityId,
      prospectId,
      demoCallId,
      assignedToId,
    },
    include: taskIncludes,
  });

  return NextResponse.json(task);
}
