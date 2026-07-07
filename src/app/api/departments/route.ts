import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const departments = await prisma.department.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { name: "asc" },
    include: {
      location: { select: { id: true, name: true } },
      _count: { select: { users: true, issues: true, assets: true } },
    },
  })
  return NextResponse.json(departments)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await request.json()
  const { name, locationId } = body
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 })

  const dept = await prisma.department.create({
    data: { name, locationId: locationId || null, organizationId: session.organizationId },
  })

  // Auto-create a channel for this department
  createDeptChannel(session.organizationId, dept.id, dept.name).catch(console.error)

  return NextResponse.json(dept, { status: 201 })
}

async function createDeptChannel(orgId: string, deptId: string, deptName: string) {
  const existing = await prisma.conversation.findFirst({
    where: { orgId, channelRefType: "department", channelRefId: deptId },
  })
  if (existing) return

  // Get all users in this department
  const members = await prisma.user.findMany({
    where: { organizationId: orgId, departmentId: deptId },
    select: { id: true },
  })

  await prisma.conversation.create({
    data: {
      orgId,
      type:          "channel",
      name:          deptName,
      channelRefType: "department",
      channelRefId:  deptId,
      members:       { create: members.map(u => ({ userId: u.id })) },
    },
  })
}
