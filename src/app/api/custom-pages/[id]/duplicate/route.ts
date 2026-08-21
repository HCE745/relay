import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { isWashEssentials } from "@/lib/pricing"
import type { InputJsonValue } from "@prisma/client/runtime/client"

const toInput = (v: unknown): InputJsonValue => JSON.parse(JSON.stringify(v ?? null)) as InputJsonValue

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (isWashEssentials(session.productLine)) {
    return NextResponse.json({ error: "Custom pages are not available on Wash Essentials" }, { status: 403 })
  }

  const { id } = await params
  const original = await prisma.customPage.findUnique({ where: { id } })
  if (!original || original.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const copy = await prisma.customPage.create({
    data: {
      organizationId: session.organizationId,
      name:           `${original.name} (Copy)`,
      icon:           original.icon,
      description:    original.description,
      widgets:        original.widgets as InputJsonValue,
      showInSidebar:  false,
      sidebarOrder:   0,
      createdBy:      session.userId,
    },
  })

  await prisma.workspaceChangeLog.create({
    data: {
      organizationId: session.organizationId,
      changedBy:      session.userId,
      changeType:     "customPage.duplicate",
      before:         toInput({ id: original.id, name: original.name }),
      after:          toInput({ id: copy.id,     name: copy.name     }),
    },
  })

  return NextResponse.json(copy)
}
