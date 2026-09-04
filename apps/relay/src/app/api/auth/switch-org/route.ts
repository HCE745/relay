import { NextRequest, NextResponse } from "next/server"
import { getSession, createSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { organizationId } = body

  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 })
  }

  // Determine the role for this org — check UserOrgMembership first, then primary org
  let targetRole: string | null = null
  let isPrimaryOrg = false

  if (session.organizationId === organizationId) {
    // Already in this org — just confirm it's valid
    targetRole = session.role
    isPrimaryOrg = true
  } else {
    // Check UserOrgMembership
    const membership = await prisma.userOrgMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: session.userId,
          organizationId,
        },
      },
    })

    if (!membership || !membership.isActive) {
      return NextResponse.json({ error: "You are not a member of this organization" }, { status: 403 })
    }

    targetRole = membership.role
  }

  // Fetch target org data for session
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      plan: true,
      productLine: true,
      subscriptionStatus: true,
      onboardingCompletedAt: true,
    },
  })

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 })
  }

  // Re-issue session with new org context
  await createSession({
    userId: session.userId,
    email: session.email,
    name: session.name,
    role: targetRole!,
    organizationId,
    plan: org.plan,
    productLine: org.productLine,
    subscriptionStatus: org.subscriptionStatus,
    onboardingCompleted: org.onboardingCompletedAt != null,
    // Preserve super admin fields if present
    ...(session.superAdmin && { superAdmin: session.superAdmin }),
    ...(session.superAdminId && { superAdminId: session.superAdminId }),
  })

  return NextResponse.json({ ok: true })
}
