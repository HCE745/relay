import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { previewRouting } from "@/lib/routing"

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { category, priority, locationId, departmentId, assetId } = body

  const result = await previewRouting({
    organizationId: session.organizationId,
    category: category ?? "GENERAL",
    priority: priority ?? "MEDIUM",
    locationId: locationId || null,
    departmentId: departmentId || null,
    assetId: assetId || null,
  })

  return NextResponse.json(result)
}
