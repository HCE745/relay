import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

async function requireSalesAuth() {
  const s = await getSession()
  return s?.superAdmin || s?.salesUserId ? s : null
}

// PATCH /api/sales/emails/[id]
// action: set_sentiment — classifies a received email as positive, neutral, or negative
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSalesAuth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body   = await req.json() as { action: string; sentiment?: string }

  if (body.action === "set_sentiment") {
    const valid = ["positive", "neutral", "negative", null]
    if (!valid.includes(body.sentiment ?? null)) {
      return NextResponse.json({ error: "Invalid sentiment value" }, { status: 400 })
    }

    const email = await prisma.crmEmail.findUnique({ where: { id } })
    if (!email) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (email.direction !== "received") {
      return NextResponse.json({ error: "Sentiment only applies to received emails" }, { status: 400 })
    }

    // Reps can only tag received emails that are replies to their own outbound messages.
    // Super admins and managers can tag any received email.
    if (!session.superAdmin && session.salesUserRole !== "admin_sales") {
      const isMyThread = await prisma.crmEmail.findFirst({
        where: {
          sentBySalesUserId: session.salesUserId!,
          ...(email.threadId ? { threadId: email.threadId } : { contactEmail: email.contactEmail ?? undefined }),
        },
        select: { id: true },
      })
      if (!isMyThread) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const updated = await prisma.crmEmail.update({
      where: { id },
      data:  { sentiment: body.sentiment ?? null },
    })
    return NextResponse.json({ sentiment: updated.sentiment })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
