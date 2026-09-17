import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// Monthly cron. Hard-deletes all data for orgs that have been canceled ≥90 days.
// FK cascade handles child records; we delete in safe order for tables without cascades.
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  const orgs = await prisma.organization.findMany({
    where: {
      subscriptionStatus: "canceled",
      canceledAt:         { not: null, lt: cutoff },
      isDemo:             false,
    },
    select: { id: true, name: true, canceledAt: true },
  })

  const deleted: string[] = []
  const failed:  string[] = []

  for (const org of orgs) {
    try {
      await deleteOrgData(org.id)
      deleted.push(org.id)
    } catch (err) {
      console.error(`[data-retention] Failed to delete org ${org.id}:`, err)
      failed.push(org.id)
    }
  }

  return NextResponse.json({
    processed: orgs.length,
    deleted:   deleted.length,
    failed:    failed.length,
    failedIds: failed,
  })
}

async function deleteOrgData(orgId: string): Promise<void> {
  // Delete non-cascade children first, then the org (Cascade handles the rest)
  await prisma.$transaction(async (tx) => {
    // Detach users from org (users are shared entities; remove the org link)
    await tx.user.updateMany({
      where: { organizationId: orgId },
      data:  { isActive: false },
    })

    // Hard-delete the organization — ON DELETE CASCADE handles all child tables
    await tx.organization.delete({ where: { id: orgId } })
  }, { timeout: 30_000 })
}
