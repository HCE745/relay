import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Fetch the user's primary org
  const primaryOrg = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { id: true, name: true },
  })

  // Fetch all UserOrgMembership entries (secondary orgs)
  const memberships = await prisma.userOrgMembership.findMany({
    where: {
      userId: session.userId,
      isActive: true,
    },
    include: {
      organization: { select: { id: true, name: true } },
    },
  })

  // Build the combined list, putting primary org first
  const primaryEntry = {
    orgId: session.organizationId,
    orgName: primaryOrg?.name ?? "Unknown",
    role: session.role,
    isPrimary: true,
  }

  // Secondary orgs (exclude the primary org in case it also appears in UserOrgMembership)
  const secondaryEntries = memberships
    .filter((m) => m.organizationId !== session.organizationId)
    .map((m) => ({
      orgId: m.organizationId,
      orgName: m.organization.name,
      role: m.role,
      isPrimary: false,
    }))

  return NextResponse.json({
    memberships: [primaryEntry, ...secondaryEntries],
  })
}
