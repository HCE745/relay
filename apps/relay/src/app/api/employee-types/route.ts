import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { EMPLOYEE_TYPE_PRESETS } from "@/lib/employee-type-presets"
import type { PageKey } from "@/lib/page-access"

// GET /api/employee-types — list org's employee types + presets
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const types = await prisma.employeeType.findMany({
    where: { organizationId: session.organizationId },
    orderBy: [{ isPreset: "desc" }, { name: "asc" }],
    include: { _count: { select: { users: true } } },
  })

  return NextResponse.json({ types, presets: EMPLOYEE_TYPE_PRESETS })
}

// POST /api/employee-types — create an employee type (from preset or from scratch)
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { name, description, baseRole, pageAccess, actions, canInvite, canChangeEmail, presetKey } = body

  if (!name?.trim() || !baseRole || !Array.isArray(pageAccess)) {
    return NextResponse.json({ error: "name, baseRole, and pageAccess are required" }, { status: 400 })
  }

  const type = await prisma.employeeType.create({
    data: {
      organizationId: session.organizationId,
      name: name.trim(),
      description: description?.trim() ?? null,
      baseRole,
      pageAccess: pageAccess as PageKey[],
      actions: Array.isArray(actions) ? actions : [],
      canInvite: canInvite ?? false,
      canChangeEmail: canChangeEmail ?? true,
      isPreset: !!presetKey,
      presetKey: presetKey ?? null,
    },
  })

  return NextResponse.json(type, { status: 201 })
}
