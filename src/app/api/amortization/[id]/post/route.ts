import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { createAndPostEntry } from "@/lib/ledger"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  const { id } = await params
  const body = await req.json().catch(() => ({})) as { periodNumbers?: number[] }

  const schedule = await prisma.amortizationSchedule.findFirst({
    where: { id, tenantId: session.tenantId },
    include: { entries: { orderBy: { periodNumber: "asc" } } },
  })

  if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (schedule.status === "VOIDED") return NextResponse.json({ error: "Schedule is voided" }, { status: 400 })

  const today = new Date()
  today.setHours(23, 59, 59, 999)

  // Filter entries to post
  let toPost = schedule.entries.filter((e) => !e.posted)
  if (body.periodNumbers?.length) {
    toPost = toPost.filter((e) => body.periodNumbers!.includes(e.periodNumber))
  } else {
    // Default: only post entries where periodDate <= today
    toPost = toPost.filter((e) => e.periodDate <= today)
  }

  const posted = []
  const errors = []

  for (const entry of toPost) {
    try {
      // PREPAID_EXPENSE: DR plAccount (expense), CR bsAccount (prepaid asset)
      // DEFERRED_REVENUE: DR bsAccount (deferred revenue liability), CR plAccount (revenue)
      const lines =
        schedule.type === "PREPAID_EXPENSE"
          ? [
              { accountId: schedule.plAccountId, debit: entry.amountCents },
              { accountId: schedule.bsAccountId, credit: entry.amountCents },
            ]
          : [
              { accountId: schedule.bsAccountId, debit: entry.amountCents },
              { accountId: schedule.plAccountId, credit: entry.amountCents },
            ]

      const journalEntry = await createAndPostEntry({
        tenantId: schedule.tenantId,
        entityId: schedule.entityId,
        date: entry.periodDate,
        memo: `${schedule.name} — Period ${entry.periodNumber}`,
        source: "AMORTIZATION",
        sourceId: schedule.id,
        createdByUserId: session.userId,
        lines,
      })

      await prisma.amortizationEntry.update({
        where: { id: entry.id },
        data: {
          posted: true,
          journalEntryId: journalEntry.id,
          postedAt: new Date(),
        },
      })

      posted.push({ entryId: entry.id, periodNumber: entry.periodNumber, journalEntryId: journalEntry.id })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      errors.push({ entryId: entry.id, periodNumber: entry.periodNumber, error: message })
    }
  }

  // Check if all entries are now posted
  const remaining = await prisma.amortizationEntry.count({
    where: { scheduleId: id, posted: false },
  })

  if (remaining === 0) {
    await prisma.amortizationSchedule.update({
      where: { id },
      data: { status: "COMPLETED" },
    })
  }

  return NextResponse.json({ posted, errors, completed: remaining === 0 })
}
