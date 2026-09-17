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

  try {
    const opportunities = await prisma.crmOpportunity.findMany({
      where,
      include: opportunityIncludes,
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(opportunities);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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

  if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });

  let assignedToId = bodyAssignedToId;
  if (!assignedToId) {
    assignedToId = info.salesUserId;
  }

  try {
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
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (code === "P2002") return NextResponse.json({ error: "Conflict" }, { status: 409 });
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
