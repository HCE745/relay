import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"
import { sendEmail } from "@/lib/email"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"

const RELATIONSHIP_TYPES = [
  "parent", "subsidiary", "tenant", "contractor",
  "vendor", "partner", "facility_owner", "facility_operator",
]

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const relationships = await prisma.organizationRelationship.findMany({
    where: {
      OR: [
        { orgIdA: session.organizationId },
        { orgIdB: session.organizationId },
      ],
    },
    include: {
      orgA: { select: { id: true, name: true } },
      orgB: { select: { id: true, name: true } },
      sharedFacilityRules: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ relationships })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { shared_facility_enabled: true, name: true },
  })
  if (!org?.shared_facility_enabled) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 403 })
  }

  const body = await req.json() as {
    inviteEmail: string
    orgBName: string
    relationshipType: string
  }

  if (!body.inviteEmail?.trim()) return NextResponse.json({ error: "Email required" }, { status: 400 })
  if (!body.orgBName?.trim()) return NextResponse.json({ error: "Organization name required" }, { status: 400 })
  if (!RELATIONSHIP_TYPES.includes(body.relationshipType)) {
    return NextResponse.json({ error: "Invalid relationship type" }, { status: 400 })
  }

  const inviteToken = randomBytes(32).toString("hex")

  const relationship = await prisma.organizationRelationship.create({
    data: {
      orgIdA: session.organizationId,
      orgIdB: null,
      relationshipType: body.relationshipType,
      status: "pending",
      createdById: session.userId,
      inviteToken,
      inviteEmail: body.inviteEmail.trim(),
      orgBName: body.orgBName.trim(),
    },
  })

  // Send invite email
  const inviteUrl = `${APP_URL}/shared-facility/accept?token=${inviteToken}`
  await sendEmail({
    to: body.inviteEmail.trim(),
    subject: `${org.name} has invited your organization to a shared facility relationship on Relay`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1e293b">Shared Facility Invitation</h2>
        <p><strong>${org.name}</strong> has invited <strong>${body.orgBName}</strong> to a shared facility relationship on Relay.</p>
        <p>Relationship type: <strong>${body.relationshipType.replace(/_/g, " ")}</strong></p>
        <p>As a shared facility partner, you'll be able to route certain issue categories between organizations seamlessly.</p>
        <a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin:16px 0">Accept Invitation</a>
        <p style="color:#64748b;font-size:13px">This link expires in 7 days. If you don't have a Relay account, you'll be prompted to create one.</p>
        <p style="color:#64748b;font-size:13px">If you weren't expecting this invitation, you can ignore this email.</p>
      </div>
    `,
  }).catch(() => {}) // Don't fail if email fails

  return NextResponse.json({ relationship, inviteToken })
}
