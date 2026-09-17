export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSalesSession } from "@/lib/sales-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const info = await getSalesSession();
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (info.isRep) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { action, reason } = body as { action: "approve" | "reject"; reason?: string };

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  }

  try {
    const request = await prisma.crmTransferRequest.findUnique({ where: { id } });
    if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const now = new Date();

    if (action === "approve") {
      const { recordType, recordId, toSalesUserId } = request;

      let fromSalesUserId: string | null = null;

      if (recordType === "prospect") {
        const record = await prisma.prospect.findUnique({ where: { id: recordId }, select: { assignedToId: true } });
        fromSalesUserId = record?.assignedToId ?? null;
        await prisma.prospect.update({ where: { id: recordId }, data: { assignedToId: toSalesUserId } });
      } else if (recordType === "democall") {
        const record = await prisma.demoCall.findUnique({ where: { id: recordId }, select: { assignedToId: true } });
        fromSalesUserId = record?.assignedToId ?? null;
        await prisma.demoCall.update({ where: { id: recordId }, data: { assignedToId: toSalesUserId } });
      } else if (recordType === "opportunity") {
        const record = await prisma.crmOpportunity.findUnique({ where: { id: recordId }, select: { assignedToId: true } });
        fromSalesUserId = record?.assignedToId ?? null;
        await prisma.crmOpportunity.update({ where: { id: recordId }, data: { assignedToId: toSalesUserId } });
      }

      await prisma.crmTransferLog.create({
        data: {
          recordType,
          recordId,
          fromSalesUserId: fromSalesUserId ?? request.requestedByUserId,
          toSalesUserId,
          transferredByUserId: info.salesUserId,
          reason: reason ?? request.reason,
          recordsTransferred: [],
        },
      });

      const updated = await prisma.crmTransferRequest.update({
        where: { id },
        data: {
          status: "approved",
          reviewedById: info.salesUserId,
          reviewedAt: now,
        },
      });

      return NextResponse.json(updated);
    }

    const updated = await prisma.crmTransferRequest.update({
      where: { id },
      data: {
        status: "rejected",
        reviewedById: info.salesUserId,
        reviewedAt: now,
      },
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
