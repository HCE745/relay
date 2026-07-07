import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createSession } from "@/lib/session"
import bcrypt from "bcryptjs"

// GET: validate token and return invitation info for the acceptance form
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      organization: { select: { name: true } },
      department: { select: { name: true } },
    },
  })

  if (!invitation) {
    return NextResponse.json({ error: "Invalid invitation link" }, { status: 404 })
  }
  if (invitation.usedAt) {
    return NextResponse.json({ error: "This invitation has already been used" }, { status: 410 })
  }
  if (invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invitation has expired" }, { status: 410 })
  }

  return NextResponse.json({
    email: invitation.email,
    role: invitation.role,
    organizationName: invitation.organization.name,
    departmentName: invitation.department?.name ?? null,
  })
}

// POST: accept invite — create user account and log them in
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const body = await request.json()
  const { name, password } = body

  if (!name || !password || password.length < 8) {
    return NextResponse.json({ error: "Name and password (min 8 chars) are required" }, { status: 400 })
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: { select: { name: true } } },
  })

  if (!invitation) return NextResponse.json({ error: "Invalid invitation link" }, { status: 404 })
  if (invitation.usedAt) return NextResponse.json({ error: "This invitation has already been used" }, { status: 410 })
  if (invitation.expiresAt < new Date()) return NextResponse.json({ error: "This invitation has expired" }, { status: 410 })

  // Check if the user already has an account (multi-org scenario)
  const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } })

  if (existingUser) {
    // User already exists — add them to this org via UserOrgMembership instead of creating a duplicate
    await prisma.userOrgMembership.upsert({
      where: {
        userId_organizationId: {
          userId: existingUser.id,
          organizationId: invitation.organizationId,
        },
      },
      create: {
        userId: existingUser.id,
        organizationId: invitation.organizationId,
        role: invitation.role,
        isActive: true,
      },
      update: {
        role: invitation.role,
        isActive: true,
      },
    })

    // Mark invitation as used
    await prisma.invitation.update({
      where: { token },
      data: { usedAt: new Date() },
    })

    // Re-issue session under the new org
    const org = await prisma.organization.findUnique({
      where: { id: invitation.organizationId },
      select: { plan: true, subscriptionStatus: true, onboardingCompletedAt: true },
    })

    await createSession({
      userId: existingUser.id,
      email: existingUser.email,
      name: existingUser.name,
      role: invitation.role,
      organizationId: invitation.organizationId,
      plan: org?.plan,
      subscriptionStatus: org?.subscriptionStatus,
      onboardingCompleted: org?.onboardingCompletedAt != null,
    })

    return NextResponse.json({ ok: true })
  }

  // Validate managerId if provided
  let managerId: string | null = null
  if (invitation.managerId) {
    const manager = await prisma.user.findFirst({
      where: { id: invitation.managerId, organizationId: invitation.organizationId },
    })
    if (manager) managerId = manager.id
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  // Build user data — set userType and expiresAt for external collaborators
  const isExternal = invitation.userType === "EXTERNAL"

  const user = await prisma.user.create({
    data: {
      name,
      email: invitation.email,
      password: hashedPassword,
      role: invitation.role,
      organizationId: invitation.organizationId,
      departmentId: invitation.departmentId,
      locationId: invitation.locationId,
      managerId,
      userType: isExternal ? "EXTERNAL" : "INTERNAL",
      ...(isExternal && invitation.accountExpiresAt
        ? { expiresAt: invitation.accountExpiresAt }
        : {}),
    },
  })

  // Also create a UserOrgMembership for the primary org to support future multi-org switching
  await prisma.userOrgMembership.create({
    data: {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      isActive: true,
    },
  })

  // Mark invitation as used
  await prisma.invitation.update({
    where: { token },
    data: { usedAt: new Date() },
  })

  // Create session so they're logged in immediately
  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
  })

  return NextResponse.json({ ok: true })
}
