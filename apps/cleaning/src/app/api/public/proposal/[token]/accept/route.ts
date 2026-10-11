import { NextResponse } from "next/server"
import { parseBody } from "@/lib/api"
import { z } from "zod"
import { acceptProposal } from "@/lib/data/proposals"
import { ConflictError } from "@/lib/data/errors"
import { clientIpFromHeaders } from "@/lib/public-intake"
type Ctx = { params: Promise<{ token: string }> }
export async function POST(request: Request, { params }: Ctx) {
  const { token } = await params
  const body = await parseBody(z.object({ signerName: z.string().trim().min(2).max(120) }), request); if (!body.ok) return body.response
  const ip = clientIpFromHeaders(request.headers)
  const userAgent = request.headers.get("user-agent") ?? ""
  try {
    const r = await acceptProposal(token, { signerName: body.data.signerName, ip, userAgent })
    return NextResponse.json({ accepted: true, customerId: r.customerId })
  } catch (e) {
    if (e instanceof ConflictError) return NextResponse.json({ error: e.message }, { status: 409 })
    throw e
  }
}
