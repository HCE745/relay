import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

const VALID_STATUSES = ["new", "investigating", "fixed", "closed"]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json() as { status?: string; adminNotes?: string }

  const data: Record<string, unknown> = {}
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }
    data.status = body.status
  }
  if (body.adminNotes !== undefined) {
    data.adminNotes = body.adminNotes
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const report = await prisma.bugReport.update({
    where: { id },
    data,
  })

  return NextResponse.json({ ok: true, report })
}
