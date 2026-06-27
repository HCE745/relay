import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { entityId } = await req.json()
  const res = NextResponse.json({ ok: true })
  res.cookies.set("hce-entity", entityId, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}
