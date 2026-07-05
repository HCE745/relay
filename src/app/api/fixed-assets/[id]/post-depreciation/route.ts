import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { postDepreciation } from "@/lib/fixed-assets"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function getEntityId(): Promise<string> {
  const cookieStore = await cookies()
  return cookieStore.get("hce-entity")?.value ?? ""
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await requireSession()
  const entityId = await getEntityId()
  const body = await req.json()

  const throughDate = body.throughDate ? new Date(body.throughDate) : new Date()

  try {
    const result = await postDepreciation(
      session.tenantId,
      entityId,
      id,
      throughDate,
      session.userId,
    )
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 })
  }
}
