import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { ISSUE_PRIORITY } from "@/lib/constants"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const issue = await prisma.issue.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      vendor: true,
      location: { select: { name: true } },
      asset: { select: { name: true, assetTag: true } },
    },
  })

  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!issue.vendor) return NextResponse.json({ error: "No vendor on this issue" }, { status: 400 })

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { name: true },
  })

  // Try to load saved custom template
  const savedTemplate = await prisma.emailTemplate.findUnique({
    where: { organizationId_key: { organizationId: session.organizationId, key: "vendor_dispatch" } },
  })

  const priorityLabel = ISSUE_PRIORITY[issue.priority as keyof typeof ISSUE_PRIORITY] ?? issue.priority

  const defaultBody = `Dear ${issue.vendor.contactName ?? issue.vendor.name},

${org?.name ?? "Our organization"} requires your assistance with the following issue:

Issue: ${issue.title}
Priority: ${priorityLabel}${issue.location ? `\nLocation: ${issue.location.name}` : ""}${issue.asset ? `\nAsset: ${issue.asset.name}${issue.asset.assetTag ? ` (${issue.asset.assetTag})` : ""}` : ""}${issue.description ? `\n\nDetails:\n${issue.description}` : ""}

Please respond to confirm your availability and estimated arrival time.

Thank you,
${org?.name ?? ""}`

  return NextResponse.json({
    vendorName: issue.vendor.name,
    vendorEmail: issue.vendor.email,
    contactName: issue.vendor.contactName,
    defaultSubject: `Service Request: ${issue.title}`,
    defaultBody: savedTemplate?.body ?? defaultBody,
    savedSubject: savedTemplate?.subject,
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { subject, body, saveTemplate } = await request.json()

  const issue = await prisma.issue.findFirst({
    where: { id, organizationId: session.organizationId },
    include: { vendor: true },
  })

  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!issue.vendor?.email) return NextResponse.json({ error: "Vendor has no email address" }, { status: 400 })

  if (saveTemplate) {
    await prisma.emailTemplate.upsert({
      where: { organizationId_key: { organizationId: session.organizationId, key: "vendor_dispatch" } },
      create: { organizationId: session.organizationId, key: "vendor_dispatch", subject, body },
      update: { subject, body },
    })
  }

  const result = await sendEmail({
    to: issue.vendor.email,
    subject,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;white-space:pre-wrap">${body.replace(/\n/g, "<br/>")}</div>`,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
