import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id }   = await params
  const { action } = await req.json() as { action: "pause" | "resume" | "stop" }

  const enrollment = await prisma.crmEmailSequenceEnrollment.findUnique({ where: { id } })
  if (!enrollment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const now = new Date()

  if (action === "pause") {
    await prisma.crmEmailSequenceEnrollment.update({ where: { id }, data: { status: "paused" } })
  } else if (action === "resume") {
    if (enrollment.status !== "paused") return NextResponse.json({ error: "Not paused" }, { status: 409 })
    await prisma.crmEmailSequenceEnrollment.update({ where: { id }, data: { status: "active" } })
  } else if (action === "stop") {
    await prisma.crmEmailSequenceEnrollment.update({
      where: { id },
      data:  { status: "stopped", stopReason: "manual", stoppedAt: now },
    })
    await prisma.crmFollowUp.updateMany({
      where: { enrollmentId: id, status: { in: ["pending", "draft_generated", "approved"] } },
      data:  { status: "skipped", errorLog: "Enrollment stopped manually" },
    })
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
