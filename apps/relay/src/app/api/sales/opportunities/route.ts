export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSalesSession, salesRepFilter } from "@/lib/sales-auth";
import { prisma } from "@/lib/prisma";

const opportunityIncludes = {
  assignedTo: { select: { id: true, name: true } },
  prospect: { select: { id: true, companyName: true } },
  demoCall: { select: { id: true, contactName: true, companyName: true } },
  commissionEvents: {
    select: { id: true, salesUserId: true, role: true, splitPercent: true, amount: true },
  },
  tasks: {
    select: { id: true, title: true, taskType: true, completedAt: true, dueAt: true, priority: true },
  },
};

export async function GET() {
  const info = await getSalesSession();
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where = salesRepFilter(info);

  const opportunities = await prisma.crmOpportunity.findMany({
    where,
    include: opportunityIncludes,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(opportunities);
}

export async function POST(req: NextRequest) {
  const info = await getSalesSession();
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    title,
    product,
    stage,
    value,
    closeDate,
    prospectId,
    demoCallId,
    organizationId,
    notes,
    assignedToId: bodyAssignedToId,
  } = body;

  let assignedToId = bodyAssignedToId;
  if (!assignedToId) {
    assignedToId = info.salesUserId;
  }

  const opportunity = await prisma.crmOpportunity.create({
    data: {
      title,
      product,
      stage: stage ?? "Qualified",
      value,
      closeDate: closeDate ? new Date(closeDate) : undefined,
      prospectId,
      demoCallId,
      organizationId,
      notes,
      assignedToId,
    },
    include: opportunityIncludes,
  });

  return NextResponse.json(opportunity);
}
