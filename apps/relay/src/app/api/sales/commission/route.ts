export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSalesSession } from "@/lib/sales-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const info = await getSalesSession();
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (info.isRep) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const opportunityId = searchParams.get("opportunityId") ?? undefined;

  const where: Record<string, unknown> = {};
  if (opportunityId) where.opportunityId = opportunityId;

  try {
    const events = await prisma.crmCommissionEvent.findMany({
      where,
      include: {
        salesUser: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true, stage: true } },
      },
    });
    return NextResponse.json(events);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const info = await getSalesSession();
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (info.isRep) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { opportunityId, events } = body;

  if (!opportunityId) return NextResponse.json({ error: "opportunityId is required" }, { status: 400 });
  if (!Array.isArray(events) || events.length === 0) return NextResponse.json({ error: "events array is required" }, { status: 400 });

  try {
    const opportunity = await prisma.crmOpportunity.findUnique({ where: { id: opportunityId } });
    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }
    if (opportunity.stage !== "Closed Won") {
      return NextResponse.json({ error: "Opportunity must be Closed Won to record commission" }, { status: 400 });
    }

    await prisma.crmCommissionEvent.deleteMany({ where: { opportunityId } });

    await prisma.crmCommissionEvent.createMany({
      data: (events as Array<{ salesUserId: string; role: string; splitPercent: number; amount?: number; notes?: string }>).map(
        (e) => ({
          opportunityId,
          salesUserId: e.salesUserId,
          role: e.role,
          splitPercent: e.splitPercent,
          amount: e.amount,
          notes: e.notes,
        })
      ),
    });

    const result = await prisma.crmCommissionEvent.findMany({
      where: { opportunityId },
      include: {
        salesUser: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true, stage: true } },
      },
    });

    return NextResponse.json(result);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (code === "P2002") return NextResponse.json({ error: "Conflict" }, { status: 409 });
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
