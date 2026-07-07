import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json() as {
    relationshipId: string
    issueCategories: string[]
    routingOrgId: string
    routingDeptId?: string
  }

  // Verify relationship belongs to this org
  const rel = await prisma.organizationRelationship.findFirst({
    where: {
      id: body.relationshipId,
      status: "active",
      OR: [{ orgIdA: session.organizationId }, { orgIdB: session.organizationId }],
    },
  })
  if (!rel) return NextResponse.json({ error: "Relationship not found or not active" }, { status: 404 })

  if (!body.issueCategories?.length) {
    return NextResponse.json({ error: "At least one category required" }, { status: 400 })
  }

  // Routing org must be the partner org
  const routingOrgId = body.routingOrgId
  const validOrgIds = [rel.orgIdA, rel.orgIdB].filter(Boolean) as string[]
  if (!validOrgIds.includes(routingOrgId)) {
    return NextResponse.json({ error: "Invalid routing org" }, { status: 400 })
  }

  const rule = await prisma.sharedFacilityRule.create({
    data: {
      relationshipId: body.relationshipId,
      issueCategories: body.issueCategories,
      routingOrgId,
      routingDeptId: body.routingDeptId ?? null,
    },
  })

  return NextResponse.json({ rule })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })

  const rule = await prisma.sharedFacilityRule.findUnique({
    where: { id },
    include: { relationship: true },
  })
  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const orgId = session.organizationId
  if (rule.relationship.orgIdA !== orgId && rule.relationship.orgIdB !== orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await prisma.sharedFacilityRule.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
