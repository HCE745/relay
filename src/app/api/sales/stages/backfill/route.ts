import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST() {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Load stage config for followUpDate calculation
  const stages = await prisma.followUpStage.findMany({ orderBy: { stageNumber: "asc" } })

  // Fetch all sent emails, ordered by contactEmail then sentAt so we can
  // group them without sorting in memory.
  const allEmails = await prisma.crmEmail.findMany({
    where:   { direction: "sent", isDeleted: false },
    select: {
      id:            true,
      contactEmail:  true,
      sentAt:        true,
      stageNumber:   true,
      followUpDate:  true,
      followUpDoneAt:true,
    },
    orderBy: [{ contactEmail: "asc" }, { sentAt: "asc" }],
  })

  // Group by lowercased contactEmail
  const byContact = new Map<string, typeof allEmails>()
  for (const email of allEmails) {
    const key = (email.contactEmail ?? "__unknown__").toLowerCase()
    if (!byContact.has(key)) byContact.set(key, [])
    byContact.get(key)!.push(email)
  }

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000)

  // Build the list of updates needed
  interface UpdateRow {
    id:           string
    stageNumber:  number
    followUpDate?: Date
  }
  const updates: UpdateRow[] = []

  for (const emails of byContact.values()) {
    // Sort ascending by sentAt within the group (they come pre-sorted from DB,
    // but sort again defensively in case of equal sentAt values)
    emails.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i]
      const correctStage = i  // 0-indexed: 0=first, 1=second, …

      const row: UpdateRow = { id: email.id, stageNumber: correctStage }

      // Assign a followUpDate only if:
      //   • the email has no followUpDate yet
      //   • the email hasn't been marked done
      //   • the email was sent within the last 90 days (avoid flooding with ancient items)
      //   • there is a configured next stage
      if (!email.followUpDate && !email.followUpDoneAt && email.sentAt > ninetyDaysAgo) {
        const nextStage = stages.find(s => s.stageNumber === correctStage + 1)
        if (nextStage && nextStage.daysAfterPrevious > 0) {
          row.followUpDate = new Date(
            email.sentAt.getTime() + nextStage.daysAfterPrevious * 86_400_000
          )
        }
      }

      updates.push(row)
    }
  }

  // Apply updates in one transaction — Prisma batches these efficiently.
  // Skip rows where nothing would change to keep the transaction lean.
  const toWrite = updates.filter(u => {
    const orig = allEmails.find(e => e.id === u.id)!
    return orig.stageNumber !== u.stageNumber || u.followUpDate != null
  })

  await prisma.$transaction(
    toWrite.map(u =>
      prisma.crmEmail.update({
        where: { id: u.id },
        data: {
          stageNumber: u.stageNumber,
          ...(u.followUpDate ? { followUpDate: u.followUpDate } : {}),
        },
      })
    )
  )

  return NextResponse.json({ updated: toWrite.length, total: updates.length })
}
