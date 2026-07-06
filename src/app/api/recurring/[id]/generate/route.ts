import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertEntityAccess } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { createAndEnterBill } from "@/lib/ap"
import { createAndPostEntry } from "@/lib/ledger"
import { createInvoice, sendInvoice } from "@/lib/ar"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function advanceDate(date: Date, frequency: string): Date {
  const d = new Date(date)
  switch (frequency) {
    case "WEEKLY":
      d.setDate(d.getDate() + 7)
      break
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1)
      break
    case "QUARTERLY":
      d.setMonth(d.getMonth() + 3)
      break
    case "ANNUAL":
      d.setFullYear(d.getFullYear() + 1)
      break
  }
  return d
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  const { id } = await params

  const template = await prisma.recurringTemplate.findFirst({
    where: { id, tenantId: session.tenantId },
  })
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const entityDeny = assertEntityAccess(session, template.entityId); if (entityDeny) return entityDeny
  if (!template.active) return NextResponse.json({ error: "Template is not active" }, { status: 400 })

  const today = new Date()
  today.setHours(23, 59, 59, 999)

  if (template.nextRunDate > today) {
    return NextResponse.json({ generated: [], skipped: 0, message: "Not yet due" })
  }

  const periodStart = template.nextRunDate
  const payload = template.payload as {
    vendorId?: string
    customerId?: string
    apAccountId?: string
    arAccountId?: string
    lines: { accountId: string; description?: string; amount?: number; debit?: number; credit?: number }[]
    memo?: string
  }

  // Idempotency: check if this period already ran
  const existingRun = await prisma.recurringRun.findUnique({
    where: { templateId_periodStart: { templateId: id, periodStart } },
  })
  if (existingRun) {
    return NextResponse.json({ generated: [], skipped: 1, message: "Already generated for this period" })
  }

  let sourceId: string | null = null
  let sourceType: string | null = null

  try {
    if (template.type === "BILL") {
      const bill = await createAndEnterBill({
        tenantId: session.tenantId,
        entityId: template.entityId,
        vendorId: payload.vendorId!,
        date: periodStart,
        dueDate: periodStart,
        memo: payload.memo,
        lines: payload.lines.map((l) => ({
          accountId: l.accountId,
          description: l.description,
          quantity: 1,
          unitPrice: l.amount ?? 0,
        })),
        apAccountId: payload.apAccountId!,
        createdByUserId: session.userId,
      })
      sourceId = bill.id
      sourceType = "Bill"
    } else if (template.type === "JOURNAL") {
      const entry = await createAndPostEntry({
        tenantId: session.tenantId,
        entityId: template.entityId,
        date: periodStart,
        memo: payload.memo ?? `Recurring: ${template.name}`,
        source: "RECURRING",
        sourceId: id,
        createdByUserId: session.userId,
        lines: payload.lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          memo: l.description ?? null,
        })),
      })
      sourceId = entry.id
      sourceType = "JournalEntry"
    } else if (template.type === "INVOICE") {
      // Auto-generate invoice number
      const count = await prisma.invoice.count({ where: { tenantId: session.tenantId } })
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`

      const invoice = await createInvoice({
        tenantId: session.tenantId,
        entityId: template.entityId,
        customerId: payload.customerId!,
        invoiceNumber,
        date: periodStart,
        dueDate: periodStart,
        memo: payload.memo,
        lines: payload.lines.map((l) => ({
          accountId: l.accountId,
          description: l.description,
          quantity: 1,
          unitPrice: l.amount ?? 0,
        })),
        createdByUserId: session.userId,
      })

      await sendInvoice({
        invoiceId: invoice.id,
        arAccountId: payload.arAccountId!,
        createdByUserId: session.userId,
      })

      sourceId = invoice.id
      sourceType = "Invoice"
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 422 })
  }

  // Record the run
  await prisma.recurringRun.create({
    data: {
      templateId: id,
      periodStart,
      sourceId,
      sourceType,
      runAt: new Date(),
    },
  })

  // Advance nextRunDate
  const nextRunDate = advanceDate(periodStart, template.frequency)
  await prisma.recurringTemplate.update({
    where: { id },
    data: { nextRunDate },
  })

  return NextResponse.json({
    generated: [{ sourceId, sourceType, periodStart }],
    skipped: 0,
  })
}
