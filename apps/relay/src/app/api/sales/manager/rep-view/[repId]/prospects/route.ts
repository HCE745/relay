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

  const prospects = await prisma.prospect.findMany({
    where: { assignedToId: repId },
    select: {
      id: true,
      companyName: true,
      currentCrmStatus: true,
      industry: true,
      aiFitScore: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  })

  return NextResponse.json(prospects)
}
