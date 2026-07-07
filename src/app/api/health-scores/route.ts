import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Return most recent score per scope
  const scores = await prisma.healthScore.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { calculatedAt: "desc" },
    take: 50,
  })

  // Deduplicate: most recent per scope
  const byScope = new Map<string, (typeof scores)[0]>()
  for (const score of scores) {
    if (!byScope.has(score.scope)) {
      byScope.set(score.scope, score)
    }
  }

  return NextResponse.json(Array.from(byScope.values()))
}
