import { NextResponse } from "next/server"
import { getManagerRepView } from "@/lib/manager-rep-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ repId: string }> },
) {
  const { repId } = await params
  const view = await getManagerRepView(repId)
  if (!view) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const opportunities = await prisma.crmOpportunity.findMany({
    where: { assignedToId: repId },
    select: {
      id: true,
      title: true,
      stage: true,
      value: true,
      closeDate: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  })

  return NextResponse.json(opportunities)
}
