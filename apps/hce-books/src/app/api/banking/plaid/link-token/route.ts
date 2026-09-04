import { NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertAccess } from "@/lib/permissions"
import { createLinkToken } from "@/lib/banking"

export const dynamic = "force-dynamic"

export async function POST() {
  const session = await requireSession()
  try {
    const linkToken = await createLinkToken(session.userId, "HCE Entity")
    return NextResponse.json({ link_token: linkToken })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
