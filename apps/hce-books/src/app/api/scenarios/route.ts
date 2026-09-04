import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertAccess } from "@/lib/permissions"
import { getSelectedEntityId } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import type { ScenarioType } from "@/generated/prisma/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const session = await requireSession()
  const { tenantId } = session
  const { searchParams } = new URL(req.url)
  const entityId = searchParams.get("entityId") ?? (await getSelectedEntityId())
  const deny = assertAccess(session, entityId, "read"); if (deny) return deny

  const scenarios = await prisma.scenario.findMany({
    where: { tenantId, entityId },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(scenarios)
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const { tenantId } = session
  const body = await req.json()

  const entityId: string = body.entityId ?? (await getSelectedEntityId())
  const entity = await prisma.entity.findFirst({ where: { id: entityId, tenantId } })
  if (!entity) return NextResponse.json({ error: "Entity not found" }, { status: 404 })

  const scenario = await prisma.scenario.create({
    data: {
      tenantId,
      entityId,
      name: body.name as string,
      type: body.type as ScenarioType,
      inputs: body.inputs,
      result: body.result,
      aiSummary: body.aiSummary ?? null,
      notes: body.notes ?? null,
    },
  })

  return NextResponse.json(scenario, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await requireSession()
  const { tenantId } = session
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const existing = await prisma.scenario.findFirst({ where: { id, tenantId } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.scenario.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
