import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { sendEmail, teamInviteEmail } from "@/lib/email"
import { randomUUID } from "crypto"
import { checkLimit, limiters } from "@/lib/ratelimit"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "HR"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const invitations = await prisma.invitation.findMany({
    where: { organizationId: session.organizationId, usedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      invitedBy: { select: { name: true } },
      department: { select: { name: true } },
    },
  })

  return NextResponse.json(invitations)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const blocked = await checkLimit(
    limiters.invitations,
    `invitations:${session.userId}`,
    "Invite limit reached. You can send up to 20 invites per hour.",
  )
  if (blocked) return blocked

  // Check permission: ADMIN, HR, or canInvite user
  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { canInvite: true, departmentId: true, name: true },
  })
  const isAdminLevel = ["ADMIN", "HR"].includes(session.role)
  if (!isAdminLevel && !currentUser?.canInvite) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const { email, role, departmentId, locationId, managerId } = body

  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 })

  // Non-admins can only invite to their own department
  const effectiveDeptId = isAdminLevel ? (departmentId || null) : currentUser?.departmentId
  // Non-admins can only assign EMPLOYEE or SUPERVISOR roles
  const allowedRoles = isAdminLevel
    ? ["ADMIN", "MANAGER", "SUPERVISOR", "EMPLOYEE", "VENDOR", "HR"]
    : ["EMPLOYEE", "SUPERVISOR"]
  const effectiveRole = allowedRoles.includes(role) ? role : "EMPLOYEE"

  // Check email not already in use
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: "Email already has an account" }, { status: 409 })

  // Check for existing pending invite
  const existingInvite = await prisma.invitation.findFirst({
    where: { email, organizationId: session.organizationId, usedAt: null, expiresAt: { gt: new Date() } },
  })
  if (existingInvite) return NextResponse.json({ error: "An active invite already exists for this email" }, { status: 409 })

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { name: true },
  })

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours

  const invitation = await prisma.invitation.create({
    data: {
      organizationId: session.organizationId,
      email,
      token,
      role: effectiveRole,
      departmentId: effectiveDeptId || null,
      locationId: locationId || null,
      managerId: managerId || null,
      invitedById: session.userId,
      expiresAt,
    },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const inviteUrl = `${appUrl}/invite/${token}`

  const orgName = org?.name ?? "Relay"
  const emailResult = await sendEmail({
    to:      email,
    subject: `${currentUser?.name ?? session.name} has invited you to join ${orgName} on Relay`,
    html:    teamInviteEmail({
      inviterName:   currentUser?.name ?? session.name,
      orgName,
      role:          effectiveRole,
      inviteUrl,
      expiresInDays: 7,
    }),
  })

  return NextResponse.json({
    id: invitation.id,
    inviteUrl,
    emailSent: emailResult.ok,
  }, { status: 201 })
}
