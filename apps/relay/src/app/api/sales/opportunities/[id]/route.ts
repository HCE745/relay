export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSalesSession, salesRepFilter } from "@/lib/sales-auth";
import { prisma } from "@/lib/prisma";

const opportunityIncludes = {
  assignedTo: { select: { id: true, name: true } },
  prospect: { select: { id: true, companyName: true, contactName: true } },
  demoCall: { select: { id: true, contactName: true, companyName: true } },
  commissionEvents: {
    select: { id: true, salesUserId: true, role: true, splitPercent: true, amount: true },
  },
  tasks: {
    select: { id: true, title: true, taskType: true, completedAt: true, dueAt: true, priority: true },
  },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const info = await getSalesSession();
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const repFilter = salesRepFilter(info);

  try {
    const opportunity = await prisma.crmOpportunity.findFirst({
      where: { id, ...repFilter },
      include: opportunityIncludes,
    });
    if (!opportunity) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(opportunity);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const info = await getSalesSession();
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const opportunity = await prisma.crmOpportunity.findUnique({ where: { id } });
    if (!opportunity) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (info.isRep && opportunity.assignedToId !== info.salesUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { title, product, stage, value, closeDate, lostReason, notes, assignedToId, organizationId, nextStep, nextStepDate } = body;

    const updateData: Record<string, unknown> = {};

    if (title !== undefined) updateData.title = title;
    if (product !== undefined) updateData.product = product;
    if (stage !== undefined) updateData.stage = stage;
    if (value !== undefined) updateData.value = value;
    if (closeDate !== undefined) updateData.closeDate = closeDate ? new Date(closeDate) : null;
    if (lostReason !== undefined) updateData.lostReason = lostReason;
    if (notes !== undefined) updateData.notes = notes;
    if (organizationId !== undefined) updateData.organizationId = organizationId;
    if (nextStep !== undefined) updateData.nextStep = nextStep;
    if (nextStepDate !== undefined) updateData.nextStepDate = nextStepDate ? new Date(nextStepDate) : null;
    if (assignedToId !== undefined && (info.isManager || info.isSuperAdmin)) {
      updateData.assignedToId = assignedToId;
    }

    if (stage === "Closed Won" && !opportunity.wonAt) {
      updateData.wonAt = new Date();
    }
    if (stage === "Closed Lost" && !opportunity.lostAt) {
      updateData.lostAt = new Date();
    }

    const updated = await prisma.crmOpportunity.update({
      where: { id },
      data: updateData,
      include: opportunityIncludes,
    });

    return NextResponse.json(updated);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (code === "P2002") return NextResponse.json({ error: "Conflict" }, { status: 409 });
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const info = await getSalesSession();
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const opportunity = await prisma.crmOpportunity.findUnique({ where: { id } });
    if (!opportunity) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (info.isRep && opportunity.assignedToId !== info.salesUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.crmOpportunity.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
