export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get("cursor")
  const limit  = Math.min(Number(searchParams.get("limit") ?? "50"), 100)

  const records = await prisma.unsubscribeRecord.findMany({
    orderBy: { addedAt: "desc" },
    take:    limit + 1,
    ...(cursor ? { cursor: { email: cursor }, skip: 1 } : {}),
  })

  const hasMore = records.length > limit
  if (hasMore) records.pop()

  return NextResponse.json({ records, nextCursor: hasMore ? records[records.length - 1]?.email : null })
}

export async function POST(req: NextRequest) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as { email: string; reason?: string; notes?: string; source?: string }
  const email  = body.email?.toLowerCase()?.trim()
  const reason = body.reason ?? "MANUAL"
  const notes  = body.notes ?? null
  const source = body.source ?? "MANUAL"

  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 })

  const VALID_REASONS = ["UNSUBSCRIBE", "DO_NOT_CONTACT", "BOUNCED", "MANUAL"]
  if (!VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 })
  }

  const record = await prisma.unsubscribeRecord.upsert({
    where:  { email },
    create: { id: `unsub_${Date.now()}`, email, reason, source, addedById: info.salesUserId ?? "sa", notes },
    update: { reason, source, notes, addedById: info.salesUserId ?? "sa" },
  })

  return NextResponse.json({ ok: true, record })
}

export async function DELETE(req: NextRequest) {
  const info = await getSalesSession()
  if (!info || (!info.isManager && !info.isSuperAdmin)) {
    return NextResponse.json({ error: "Manager or SA required" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const email = searchParams.get("email")?.toLowerCase()
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 })

  await prisma.unsubscribeRecord.deleteMany({ where: { email } })
  return NextResponse.json({ ok: true })
}
