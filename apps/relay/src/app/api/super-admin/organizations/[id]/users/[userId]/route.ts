import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { logSAAction } from "@/lib/sa-audit"

const VALID_ROLES = ["ADMIN", "MANAGER", "SUPERVISOR", "HR", "EMPLOYEE", "VENDOR"]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: orgId, userId } = await params
  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 })

  const user = await prisma.user.findFirst({ where: { id: userId, organizationId: orgId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = await req.json() as { role?: string; isActive?: boolean }

  const before: Record<string, unknown> = {}
  const after:  Record<string, unknown> = {}
  const data:   Record<string, unknown> = {}

  let action: "CHANGE_USER_ROLE" | "CHANGE_USER_STATUS" = "CHANGE_USER_ROLE"

  if (body.role !== undefined) {
    if (!VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }
    before.role = user.role
    after.role  = body.role
    data.role   = body.role
    action      = "CHANGE_USER_ROLE"
  }

  if (body.isActive !== undefined) {
    before.isActive = user.isActive
    after.isActive  = body.isActive
    data.isActive   = body.isActive
    action          = "CHANGE_USER_STATUS"
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 })
  }

  await prisma.user.update({ where: { id: userId }, data })

  await logSAAction({
    superAdminId:   session.superAdminId,
    superAdminName: session.name,
    action,
    orgId:      org.id,
    orgName:    org.name,
    targetType: "user",
    targetId:   user.id,
    targetName: user.name,
    before,
    after,
  })

  return NextResponse.json({ success: true })
}
