import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const config = await prisma.sSOConfig.findUnique({
    where: { organizationId: session.organizationId },
  })

  return NextResponse.json({ config })
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { sso_foundation_enabled: true },
  })
  if (!org?.sso_foundation_enabled) {
    return NextResponse.json({ error: "Feature not enabled" }, { status: 403 })
  }

  const body = await req.json() as {
    providerType: string
    clientId?: string
    tenantIdOrDomain?: string
    ssoEnabled?: boolean
  }

  const config = await prisma.sSOConfig.upsert({
    where: { organizationId: session.organizationId },
    create: {
      organizationId: session.organizationId,
      providerType: body.providerType,
      clientId: body.clientId?.trim() || null,
      tenantIdOrDomain: body.tenantIdOrDomain?.trim() || null,
      ssoEnabled: false, // can't enable without full implementation
      status: body.clientId ? "pending" : "not_configured",
    },
    update: {
      providerType: body.providerType,
      clientId: body.clientId?.trim() || null,
      tenantIdOrDomain: body.tenantIdOrDomain?.trim() || null,
      status: body.clientId ? "pending" : "not_configured",
    },
  })

  return NextResponse.json({ config })
}
