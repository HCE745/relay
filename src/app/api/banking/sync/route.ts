import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { syncBankAccount } from "@/lib/banking"

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const { bankAccountId } = await req.json()

  try {
    const result = await syncBankAccount(bankAccountId)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
