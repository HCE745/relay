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

  const lists = await prisma.prospectResearchList.findMany({
    where: { salesUserId: repId, isExplicitlySaved: true },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      _count: { select: { results: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(lists)
}
