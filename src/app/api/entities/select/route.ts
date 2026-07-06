import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertEntityAccess } from "@/lib/permissions"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const { entityId } = await req.json()

  const deny = assertEntityAccess(session, entityId)
  if (deny) return deny

  const res = NextResponse.json({ ok: true })
  res.cookies.set("hce-entity", entityId, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}
