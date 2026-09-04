import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// GET /api/conversations/org-users — all users in the same org (for people picker)
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const users = await prisma.user.findMany({
    where:   { organizationId: session.organizationId, id: { not: session.userId } },
    select:  { id: true, name: true, role: true, email: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json({ users })
}
