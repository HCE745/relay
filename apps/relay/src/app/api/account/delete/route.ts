import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// Self-service org deletion. ADMIN only.
// Immediately hard-deletes all org data (ON DELETE CASCADE handles child records).
export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN" && !session.superAdmin) {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 })
  }

  const orgId = session.organizationId

  try {
    await prisma.$transaction(async (tx) => {
      // Mark users inactive before deleting the org
      await tx.user.updateMany({
        where: { organizationId: orgId },
        data:  { isActive: false },
      })
      await tx.organization.delete({ where: { id: orgId } })
    }, { timeout: 30_000 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[account/delete] Failed to delete org:", err)
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }
}
