import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Returns pre-filled bill data from the PO so the bill form can be pre-populated.
// Does NOT create a bill — bill creation still goes through /api/bills → ap.ts.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await requireSession()

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      vendor: { select: { id: true, name: true } },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  })

  if (!po || po.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (!["OPEN", "PARTIALLY_RECEIVED"].includes(po.status)) {
    return NextResponse.json(
      { error: `PO is ${po.status} — only OPEN or PARTIALLY_RECEIVED POs can be matched` },
      { status: 400 }
    )
  }

  return NextResponse.json({
    poId: po.id,
    poNumber: po.poNumber,
    vendorId: po.vendorId,
    vendorName: po.vendor.name,
    totalCents: po.totalCents,
    lines: po.lines.map((l) => ({
      description: l.description ?? "",
      qty: l.qty,
      unitPriceCents: l.unitPriceCents,
      amountCents: l.amountCents,
      accountId: l.accountId ?? "",
    })),
  })
}
