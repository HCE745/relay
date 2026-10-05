// Commission payment status management — managers/super-admins only.
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
  if (!info.isManager && !info.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as {
    action: "approve" | "pay" | "void";
    paidAt?: string;
    notes?: string;
  };

  const payment = await prisma.commissionPayment.findUnique({ where: { id } });
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updateData: Record<string, unknown> = { notes: body.notes ?? payment.notes };

  switch (body.action) {
    case "approve":
      if (payment.commissionStatus !== "PENDING")
        return NextResponse.json({ error: "Only PENDING payments can be approved" }, { status: 422 });
      updateData.commissionStatus = "APPROVED";
      updateData.approvedById     = info.salesUserId;
      updateData.approvedAt       = new Date();
      break;

    case "pay":
      if (payment.commissionStatus !== "APPROVED")
        return NextResponse.json({ error: "Only APPROVED payments can be marked as paid" }, { status: 422 });
      updateData.commissionStatus  = "PAID";
      updateData.commissionPaidAt  = body.paidAt ? new Date(body.paidAt) : new Date();
      break;

    case "void":
      if (payment.commissionStatus === "PAID")
        return NextResponse.json({ error: "Paid commissions cannot be voided" }, { status: 422 });
      updateData.commissionStatus = "VOIDED";
      break;

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const updated = await prisma.commissionPayment.update({ where: { id }, data: updateData });
  return NextResponse.json(updated);
}
