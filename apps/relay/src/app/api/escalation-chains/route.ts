import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session || !["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const chains = await prisma.escalationChain.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  })

  return NextResponse.json({ chains })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { advanced_escalations_enabled: true },
  })
  if (!org?.advanced_escalations_enabled) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 403 })
  }

  const body = await req.json() as {
    name: string
    description?: string
    triggerPriority?: string
    triggerCategory?: string
    triggerLocationId?: string
    triggerDepartmentId?: string
    hoursToFirst?: number
    steps: Array<{ label?: string; userId?: string; role?: string; notifyVia?: string; hoursAfterPrevious?: number }>
  }

  if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 })
  if (!body.steps || body.steps.length === 0) return NextResponse.json({ error: "At least one step required" }, { status: 400 })

  const chain = await prisma.escalationChain.create({
    data: {
      name: body.name.trim(),
      description: body.description?.trim() || null,
      organizationId: session.organizationId,
      triggerPriority: body.triggerPriority || null,
      triggerCategory: body.triggerCategory || null,
      triggerLocationId: body.triggerLocationId || null,
      triggerDepartmentId: body.triggerDepartmentId || null,
      hoursToFirst: body.hoursToFirst ?? 24,
      steps: {
        create: body.steps.map((s, i) => ({
          stepOrder: i + 1,
          label: s.label?.trim() || null,
          userId: s.userId || null,
          role: s.role || null,
          notifyVia: s.notifyVia ?? "EMAIL",
          hoursAfterPrevious: s.hoursAfterPrevious ?? 24,
        })),
      },
    },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  })

  return NextResponse.json({ chain })
}
