import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { aiSuggestionsAvailable: true, aiSuggestionsPolicy: true, aiSuggestionsAudience: true },
  })
  if (!org?.aiSuggestionsAvailable) {
    return NextResponse.json({ error: "AI Suggestions not available for this organization" }, { status: 403 })
  }
  return NextResponse.json({
    policy: org.aiSuggestionsPolicy,
    audience: org.aiSuggestionsAudience,
  })
}

export async function PATCH(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const available = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { aiSuggestionsAvailable: true },
  })
  if (!available?.aiSuggestionsAvailable) {
    return NextResponse.json({ error: "AI Suggestions not available for this organization" }, { status: 403 })
  }

  const body = await request.json() as { policy?: string; audience?: string }

  const updateData: { aiSuggestionsPolicy?: string; aiSuggestionsAudience?: string } = {}

  if (body.policy !== undefined) {
    if (!["off_all", "on_all", "user_choice"].includes(body.policy)) {
      return NextResponse.json({ error: "Invalid policy value" }, { status: 400 })
    }
    updateData.aiSuggestionsPolicy = body.policy
  }

  if (body.audience !== undefined) {
    if (!["submitter_only", "assignee_only", "both"].includes(body.audience)) {
      return NextResponse.json({ error: "Invalid audience value" }, { status: 400 })
    }
    updateData.aiSuggestionsAudience = body.audience
  }

  const org = await prisma.organization.update({
    where: { id: session.organizationId },
    data: updateData,
    select: { aiSuggestionsPolicy: true, aiSuggestionsAudience: true },
  })

  return NextResponse.json({
    policy: org.aiSuggestionsPolicy,
    audience: org.aiSuggestionsAudience,
  })
}
