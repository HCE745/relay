import { NextResponse } from "next/server"
import { declineProposal } from "@/lib/data/proposals"
import { ConflictError } from "@/lib/data/errors"
type Ctx = { params: Promise<{ token: string }> }
export async function POST(_request: Request, { params }: Ctx) {
  const { token } = await params
  try { await declineProposal(token); return NextResponse.json({ declined: true }) }
  catch (e) { if (e instanceof ConflictError) return NextResponse.json({ error: e.message }, { status: 409 }); throw e }
}
