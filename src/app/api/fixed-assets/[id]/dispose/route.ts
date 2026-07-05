import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { disposeAsset } from "@/lib/fixed-assets"
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

  const {
    disposalDate,
    proceedsCents,
    cashAccountId,
    gainLossAccountId,
    memo,
  } = body as {
    disposalDate: string
    proceedsCents: number
    cashAccountId?: string
    gainLossAccountId: string
    memo?: string
  }

  if (!gainLossAccountId) {
    return NextResponse.json({ error: "gainLossAccountId is required" }, { status: 400 })
  }

  try {
    const result = await disposeAsset(
      session.tenantId,
      entityId,
      id,
      {
        disposalDate: new Date(disposalDate ?? new Date()),
        proceedsCents: proceedsCents ?? 0,
        cashAccountId: cashAccountId || null,
        gainLossAccountId,
        memo,
      },
      session.userId,
    )
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 })
  }
}
