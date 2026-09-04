import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const runs = await prisma.visibilityRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 50,
  })

  return NextResponse.json({ runs })
}
