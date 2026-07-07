import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { resetDemoOrg } from "@/lib/demo-seed"

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session?.isDemo) {
    return NextResponse.json({ error: "Not a demo session" }, { status: 403 })
  }

  let industry: string | undefined
  try {
    const body = await request.json() as { industry?: string }
    industry = body.industry?.trim() || undefined
  } catch {
    // body is optional
  }

  await resetDemoOrg(session.organizationId, session.userId, industry)
  return NextResponse.json({ ok: true })
}
