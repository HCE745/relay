import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const org = await prisma.organization.findUnique({
    where:  { id: session.organizationId },
    select: { subscriptionStatus: true, plan: true },
  })

  return NextResponse.json({
    status: org?.subscriptionStatus ?? "unknown",
    plan:   org?.plan ?? "unknown",
  })
}
