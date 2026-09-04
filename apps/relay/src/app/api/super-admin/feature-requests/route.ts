import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const q      = searchParams.get("q")

  const where: Record<string, unknown> = {}
  if (status && status !== "all") where.status = status
  if (q) {
    where.OR = [
      { orgName:          { contains: q, mode: "insensitive" } },
      { submittedByName:  { contains: q, mode: "insensitive" } },
      { description:      { contains: q, mode: "insensitive" } },
    ]
  }

  const requests = await prisma.featureRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id:              true,
      orgName:         true,
      submittedByName: true,
      submittedByRole: true,
      description:     true,
      useCase:         true,
      frequency:       true,
      status:          true,
      createdAt:       true,
    },
  })

  return NextResponse.json(requests)
}
