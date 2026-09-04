import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertAccess } from "@/lib/permissions"
import { createAndPostEntry } from "@/lib/ledger"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await requireSession()
  const { searchParams } = new URL(req.url)
  const entityId = searchParams.get("entityId") ?? ""
  const limit = parseInt(searchParams.get("limit") ?? "50", 10)
  const deny = assertAccess(session, entityId, "read"); if (deny) return deny

  const entries = await prisma.journalEntry.findMany({
    where: { tenantId: session.tenantId, entityId },
    include: { lines: { include: { account: true } } },
    orderBy: { date: "desc" },
    take: limit,
  })

  return NextResponse.json(entries)
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const body = await req.json()
  const deny2 = assertAccess(session, body.entityId, "post"); if (deny2) return deny2

  const entry = await createAndPostEntry({
    tenantId: session.tenantId,
    entityId: body.entityId,
    date: new Date(body.date),
    memo: body.memo,
    source: body.source ?? "MANUAL",
    lines: body.lines,
    createdByUserId: session.userId,
  })

  return NextResponse.json(entry)
}
