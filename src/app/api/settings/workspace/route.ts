import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { isWashEssentials } from "@/lib/pricing"
import { Prisma } from "@/generated/prisma/client"
import type { InputJsonValue } from "@prisma/client/runtime/client"

// JSON round-trip converts Prisma JsonValue → plain InputJsonValue (removes non-serializable references)
const toInput = (v: unknown): InputJsonValue => JSON.parse(JSON.stringify(v ?? null)) as InputJsonValue

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (isWashEssentials(session.productLine)) {
    return NextResponse.json({ error: "Workspace customization is not available on Wash Essentials" }, { status: 403 })
  }

  const body = await request.json() as {
    navigationConfig?: Record<string, unknown>
    terminologyConfig?: Record<string, string>
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { navigationConfig: true, terminologyConfig: true },
  })

  const beforeNav  = org?.navigationConfig  ?? null
  const beforeTerm = org?.terminologyConfig ?? null
  const afterNav   = body.navigationConfig  ?? beforeNav
  const afterTerm  = body.terminologyConfig ?? beforeTerm

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: session.organizationId },
      data: {
        navigationConfig:  afterNav  != null ? toInput(afterNav)  : Prisma.DbNull,
        terminologyConfig: afterTerm != null ? toInput(afterTerm) : Prisma.DbNull,
      },
    }),
    prisma.workspaceChangeLog.create({
      data: {
        organizationId: session.organizationId,
        changedBy:      session.userId,
        changeType:     "workspace",
        before: toInput({ navigationConfig: beforeNav, terminologyConfig: beforeTerm }),
        after:  toInput({ navigationConfig: afterNav,  terminologyConfig: afterTerm  }),
      },
    }),
  ])

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (isWashEssentials(session.productLine)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json() as { field: "navigationConfig" | "terminologyConfig" | "all" }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { navigationConfig: true, terminologyConfig: true },
  })

  const beforeNav  = org?.navigationConfig  ?? null
  const beforeTerm = org?.terminologyConfig ?? null
  const resetNav   = body.field === "all" || body.field === "navigationConfig"
  const resetTerm  = body.field === "all" || body.field === "terminologyConfig"

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: session.organizationId },
      data: {
        ...(resetNav  ? { navigationConfig:  Prisma.DbNull } : {}),
        ...(resetTerm ? { terminologyConfig: Prisma.DbNull } : {}),
      },
    }),
    prisma.workspaceChangeLog.create({
      data: {
        organizationId: session.organizationId,
        changedBy:      session.userId,
        changeType:     "reset",
        before: toInput({ navigationConfig: beforeNav, terminologyConfig: beforeTerm }),
        after:  toInput({
          navigationConfig:  resetNav  ? null : beforeNav,
          terminologyConfig: resetTerm ? null : beforeTerm,
        }),
      },
    }),
  ])

  return NextResponse.json({ ok: true })
}
