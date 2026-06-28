import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { exchangePublicToken } from "@/lib/banking"
import { getSelectedEntityId } from "@/lib/entity-context"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const { publicToken, accountName, ledgerAccountId } = await req.json()
  const entityId = await getSelectedEntityId()

  const bankAccount = await exchangePublicToken({
    tenantId: session.tenantId,
    entityId,
    publicToken,
    ledgerAccountId,
    accountName,
  })

  return NextResponse.json(bankAccount)
}
