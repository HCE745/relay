export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSalesSession } from "@/lib/sales-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const info = await getSalesSession();
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { recordType, recordId, toSalesUserId, reason } = body as {
    recordType: "prospect" | "democall" | "opportunity";
    recordId: string;
    toSalesUserId: string;
    reason?: string;
  };

  if (!recordId) return NextResponse.json({ error: "recordId is required" }, { status: 400 });
  if (!toSalesUserId) return NextResponse.json({ error: "toSalesUserId is required" }, { status: 400 });
  if (!["prospect", "democall", "opportunity"].includes(recordType)) {
    return NextResponse.json({ error: "recordType must be prospect, democall, or opportunity" }, { status: 400 });
  }

  try {
    if (info.isSuperAdmin || info.isManager) {
      let fromSalesUserId: string | null = null;
      if (recordType === "prospect") {
        const r = await prisma.prospect.findUnique({ where: { id: recordId }, select: { assignedToId: true } });
        fromSalesUserId = r?.assignedToId ?? null;
        await prisma.prospect.update({ where: { id: recordId }, data: { assignedToId: toSalesUserId } });
      } else if (recordType === "democall") {
        const r = await prisma.demoCall.findUnique({ where: { id: recordId }, select: { assignedToId: true } });
        fromSalesUserId = r?.assignedToId ?? null;
        await prisma.demoCall.update({ where: { id: recordId }, data: { assignedToId: toSalesUserId } });
      } else if (recordType === "opportunity") {
        const r = await prisma.crmOpportunity.findUnique({ where: { id: recordId }, select: { assignedToId: true } });
        fromSalesUserId = r?.assignedToId ?? null;
        await prisma.crmOpportunity.update({ where: { id: recordId }, data: { assignedToId: toSalesUserId } });
      }

      await prisma.crmTransferLog.create({
        data: {
          recordType,
          recordId,
          fromSalesUserId,
          toSalesUserId,
          transferredByUserId: info.isSuperAdmin ? null : info.salesUserId,
          reason,
          recordsTransferred: [],
        },
      });

      return NextResponse.json({ transferred: true });
    }

    await prisma.crmTransferRequest.create({
      data: {
        recordType,
        recordId,
        requestedByUserId: info.salesUserId,
        toSalesUserId,
        reason,
        status: "pending",
      },
    });

    return NextResponse.json({ requested: true });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (code === "P2002") return NextResponse.json({ error: "Conflict" }, { status: 409 });
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
