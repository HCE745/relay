import { NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSalesSession()
  if (!session?.isManager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  // super-admin sees all active reps; managers see only their assigned reps
  const where = session.isSuperAdmin
    ? { role: "sales_rep", isActive: true }
    : { role: "sales_rep", isActive: true, managerId: session.salesUserId }

  const reps = await prisma.salesUser.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      sessions: {
        orderBy: { loginAt: "desc" },
        take: 1,
        select: { loginAt: true, lastActivityAt: true },
      },
    },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(
    reps.map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      lastActiveAt: r.sessions[0]?.lastActivityAt ?? r.sessions[0]?.loginAt ?? null,
    })),
  )
}
