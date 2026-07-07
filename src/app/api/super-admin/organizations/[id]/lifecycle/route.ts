import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { setLifecycle } from "@/lib/crm-lifecycle"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const { status } = await req.json() as { status: string }
  if (!status) return NextResponse.json({ error: "status required" }, { status: 400 })

  const org = await prisma.organization.findUnique({
    where:  { id },
    select: { lifecycleStatus: true },
  })
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await setLifecycle(id, status, session.name, org.lifecycleStatus)

  return NextResponse.json({ ok: true })
}
