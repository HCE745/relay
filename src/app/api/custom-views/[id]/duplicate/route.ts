import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { isWashEssentials } from "@/lib/pricing"
import { Prisma } from "@/generated/prisma/client"
import type { InputJsonValue } from "@prisma/client/runtime/client"

const toInput = (v: unknown): InputJsonValue => JSON.parse(JSON.stringify(v ?? null)) as InputJsonValue

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (isWashEssentials(session.productLine)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const source = await prisma.customView.findUnique({ where: { id } })
  if (!source || source.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const copy = await prisma.customView.create({
    data: {
      organizationId: session.organizationId,
      sourceType:     source.sourceType,
      name:           `${source.name} (Copy)`,
      icon:           source.icon,
      filters:        source.filters != null ? toInput(source.filters) : Prisma.DbNull,
      columns:        source.columns != null ? toInput(source.columns) : Prisma.DbNull,
      sortField:      source.sortField,
      sortDir:        source.sortDir,
      showInSidebar:  false,
      sidebarOrder:   source.sidebarOrder,
      createdBy:      session.userId,
    },
  })

  await prisma.workspaceChangeLog.create({
    data: {
      organizationId: session.organizationId,
      changedBy:      session.userId,
      changeType:     "customView.duplicate",
      before:         toInput({ id: source.id, name: source.name }),
      after:          toInput({ id: copy.id,   name: copy.name   }),
    },
  })

  return NextResponse.json(copy)
}
