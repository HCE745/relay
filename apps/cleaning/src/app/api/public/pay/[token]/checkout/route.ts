import { NextResponse } from "next/server"
import { createCheckoutForToken } from "@/lib/data/payments"
import { ReferenceError, ConflictError } from "@/lib/data/errors"
type Ctx = { params: Promise<{ token: string }> }
// PUBLIC — no login. Creates a Stripe Checkout Session for a tokenized invoice.
export async function POST(request: Request, { params }: Ctx) {
  const { token } = await params
  const origin = new URL(request.url).origin
  const base = process.env.CLEANING_APP_URL ?? origin
  try {
    const { url } = await createCheckoutForToken(token, base)
    return NextResponse.json({ url })
  } catch (e) {
    if (e instanceof ReferenceError) return NextResponse.json({ error: e.message }, { status: 404 })
    if (e instanceof ConflictError) return NextResponse.json({ error: e.message }, { status: 409 })
    throw e
  }
}
