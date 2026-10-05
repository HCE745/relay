// Rep-facing: returns the authenticated rep's commission data.
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSalesSession } from "@/lib/sales-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const info = await getSalesSession();
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = info.salesUserId;
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const attributions = await prisma.commissionAttribution.findMany({
    where: { commissionOwnerId: ownerId },
    include: {
      opportunity: {
        select: {
          id: true, title: true, stage: true, closedAt: true, value: true,
          customerOrganizationId: true,
        },
      },
      payments: {
        orderBy: { paymentReceivedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Aggregate summary
  const allPayments = attributions.flatMap(a => a.payments);
  const summary = {
    pendingAmount:  sum(allPayments.filter(p => p.commissionStatus === "PENDING").map(p => Number(p.commissionAmount))),
    approvedAmount: sum(allPayments.filter(p => p.commissionStatus === "APPROVED").map(p => Number(p.commissionAmount))),
    paidAmount:     sum(allPayments.filter(p => p.commissionStatus === "PAID").map(p => Number(p.commissionAmount))),
    lifetimeEarned: sum(allPayments.filter(p => ["APPROVED","PAID"].includes(p.commissionStatus)).map(p => Number(p.commissionAmount))),
  };

  return NextResponse.json({ attributions, summary });
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
