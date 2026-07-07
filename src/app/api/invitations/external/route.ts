import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { sendEmail, teamInviteEmail } from "@/lib/email"
import { randomUUID } from "crypto"

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin role required" }, { status: 403 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { name: true, external_collaborators_enabled: true },
  })

  if (!org?.external_collaborators_enabled) {
    return NextResponse.json(
      { error: "External collaborators are not enabled for this organization" },
      { status: 403 }
    )
  }

  const body = await request.json()
  const { email, role, departmentId, locationId, expiresAt } = body

  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 })

  // Check email not already in use
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "Email already has an account" }, { status: 409 })
  }

  // Check for existing pending invite
  const existingInvite = await prisma.invitation.findFirst({
    where: {
      email,
      organizationId: session.organizationId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  })
  if (existingInvite) {
    return NextResponse.json(
      { error: "An active invite already exists for this email" },
      { status: 409 }
    )
  }

  const inviter = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true },
  })

  const token = randomUUID()
  const invitationExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours
  const effectiveRole = role ?? "EMPLOYEE"

  const invitation = await prisma.invitation.create({
    data: {
      organizationId: session.organizationId,
      email,
      token,
      role: effectiveRole,
      userType: "EXTERNAL",
      departmentId: departmentId ?? null,
      locationId: locationId ?? null,
      accountExpiresAt: expiresAt ? new Date(expiresAt) : null,
      invitedById: session.userId,
      expiresAt: invitationExpiresAt,
    },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const inviteUrl = `${appUrl}/invite/${token}`
  const orgName = org.name ?? "Relay"

  await sendEmail({
    to: email,
    subject: `${inviter?.name ?? session.name} has invited you to collaborate on ${orgName}`,
    html: teamInviteEmail({
      inviterName: inviter?.name ?? session.name,
      orgName,
      role: effectiveRole,
      inviteUrl,
      expiresInDays: 3,
    }),
  })

  return NextResponse.json({ ok: true, invitationId: invitation.id }, { status: 201 })
}
