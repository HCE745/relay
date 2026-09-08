import "server-only"
import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json() as { action: "feedback" | "archive" }

  const feedback = await prisma.customerFeedback.findUnique({ where: { id } })
  if (!feedback) return NextResponse.json({ error: "Feedback not found" }, { status: 404 })
  if (feedback.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const status = body.action === "feedback" ? "RECORDED_AS_FEEDBACK" : "ARCHIVED"
  await prisma.customerFeedback.update({ where: { id }, data: { status } })

  return NextResponse.json({ ok: true, status })
}
