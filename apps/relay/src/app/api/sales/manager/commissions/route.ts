// Manager/admin: full commission ledger across all reps.
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSalesSession } from "@/lib/sales-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const info = await getSalesSession();
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!info.isManager && !info.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const exportCsv = searchParams.get("export") === "csv";

  // All reps with their attributions + payments
  const reps = await prisma.salesUser.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, email: true, role: true,
      employmentStatus: true, commissionEligible: true, commissionRate: true,
      commissionAttributions: {
        include: {
          opportunity: {
            select: { id: true, title: true, closedAt: true, value: true, stage: true },
          },
          payments: { orderBy: { paymentReceivedAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // Aggregate per rep
  const repSummaries = reps.map(rep => {
    const allPayments = rep.commissionAttributions.flatMap(a => a.payments);
    return {
      rep: {
        id: rep.id, name: rep.name, email: rep.email, role: rep.role,
        employmentStatus: rep.employmentStatus,
        commissionEligible: rep.commissionEligible,
        commissionRate: Number(rep.commissionRate),
      },
      activeAccountCount: rep.commissionAttributions.filter(
        a => a.attributionStatus !== "REVOKED"
      ).length,
      totalMrr: rep.commissionAttributions.reduce(
        (acc, a) => acc + allPayments
          .filter(p => p.attributionId === a.id && p.commissionStatus !== "VOIDED")
          .reduce((s, p) => s + Number(p.grossRevenue), 0),
        0
      ),
      pendingCommission:  sumPayments(allPayments, "PENDING"),
      approvedCommission: sumPayments(allPayments, "APPROVED"),
      paidCommission:     sumPayments(allPayments, "PAID"),
      attributions: rep.commissionAttributions,
    };
  });

  // Company totals
  const allPayments = repSummaries.flatMap(r => r.attributions.flatMap(a => a.payments));
  const totals = {
    totalGrossRevenue:     allPayments.filter(p => p.commissionStatus !== "VOIDED").reduce((s, p) => s + Number(p.grossRevenue), 0),
    totalCommissionDue:    allPayments.filter(p => ["PENDING","APPROVED"].includes(p.commissionStatus)).reduce((s, p) => s + Number(p.commissionAmount), 0),
    totalCommissionPaid:   allPayments.filter(p => p.commissionStatus === "PAID").reduce((s, p) => s + Number(p.commissionAmount), 0),
  };

  if (exportCsv) {
    const rows = [
      ["Rep", "Email", "Customer", "Close Date", "Gross Revenue", "Commission Rate", "Commission Amount", "Status", "Period Start", "Period End", "Paid At", "Attribution Status", "Attribution Reason"].join(","),
      ...repSummaries.flatMap(r =>
        r.attributions.flatMap(a =>
          a.payments.map(p => [
            `"${r.rep.name}"`,
            `"${r.rep.email}"`,
            `"${a.opportunity.title}"`,
            a.opportunity.closedAt ? new Date(a.opportunity.closedAt).toISOString().slice(0,10) : "",
            Number(p.grossRevenue).toFixed(2),
            Number(p.commissionRate).toFixed(2),
            Number(p.commissionAmount).toFixed(2),
            p.commissionStatus,
            p.periodStart ? new Date(p.periodStart).toISOString().slice(0,10) : "",
            p.periodEnd   ? new Date(p.periodEnd).toISOString().slice(0,10)   : "",
            p.commissionPaidAt ? new Date(p.commissionPaidAt).toISOString().slice(0,10) : "",
            a.attributionStatus,
            a.attributionReason,
          ].join(","))
        )
      ),
    ].join("\n");

    return new Response(rows, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="commission-ledger-${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ repSummaries, totals });
}

function sumPayments(payments: { commissionStatus: string; commissionAmount: unknown }[], status: string): number {
  return payments.filter(p => p.commissionStatus === status).reduce((s, p) => s + Number(p.commissionAmount), 0);
}
