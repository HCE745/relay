import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

const ALLOWED_STATUSES = ["new", "under_review", "planned", "declined", "shipped"]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json() as { status?: string }

  if (!body.status || !ALLOWED_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const updated = await prisma.featureRequest.update({
    where: { id },
    data:  { status: body.status },
    select: { id: true, status: true },
  })

  return NextResponse.json(updated)
}
