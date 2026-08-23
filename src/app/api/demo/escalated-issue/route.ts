import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const issue = await prisma.issue.findFirst({
    where: { organizationId: session.organizationId, isEscalated: true },
    select: { id: true },
  })

  return NextResponse.json({ id: issue?.id ?? null })
}
