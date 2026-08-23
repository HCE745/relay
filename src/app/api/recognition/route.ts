import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { isRecognitionEnabled } from "@/lib/pricing"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const isAdminOrHR = session.role === "ADMIN" || session.role === "HR"

  // Admins/HR see all; others see PUBLIC + their own PRIVATE (as recipient or grantor)
  const recognitions = await prisma.recognition.findMany({
    where: {
      organizationId: session.organizationId,
      ...(isAdminOrHR ? {} : {
        OR: [
          { visibility: "PUBLIC" },
          { recipientId: session.userId },
          { grantedById: session.userId },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      recipient:  { select: { id: true, name: true } },
      grantedBy:  { select: { id: true, name: true } },
      suggestion: { select: { id: true, content: true } },
    },
  })

  return NextResponse.json(recognitions)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Only ADMIN, HR, MANAGER can give recognition
  if (!["ADMIN", "HR", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Only Admin, HR, or Manager can give recognition" }, { status: 403 })
  }

  const org = await prisma.organization.findUnique({
    where:  { id: session.organizationId },
    select: { plan: true, recognition_enabled: true },
  })
  if (!isRecognitionEnabled(org?.plan ?? "essentials", org?.recognition_enabled ?? false)) {
    return NextResponse.json({ error: "Recognition is not enabled for this organization" }, { status: 403 })
  }

  const { recipientId, message, visibility, suggestionId } = await request.json()

  if (!recipientId?.trim()) return NextResponse.json({ error: "Recipient is required" }, { status: 400 })
  if (!message?.trim())     return NextResponse.json({ error: "Message is required" }, { status: 400 })

  const validVisibility = ["PUBLIC", "PRIVATE"].includes(visibility) ? visibility : "PUBLIC"

  // Verify recipient is in the same org
  const recipient = await prisma.user.findFirst({
    where: { id: recipientId, organizationId: session.organizationId },
    select: { id: true, name: true },
  })
  if (!recipient) return NextResponse.json({ error: "Recipient not found" }, { status: 404 })

  // If linked to a suggestion, verify it belongs to this org and isn't already recognized
  if (suggestionId) {
    const suggestion = await prisma.suggestion.findFirst({
      where: { id: suggestionId, organizationId: session.organizationId },
    })
    if (!suggestion) return NextResponse.json({ error: "Suggestion not found" }, { status: 404 })
    const existing = await prisma.recognition.findUnique({ where: { suggestionId } })
    if (existing) return NextResponse.json({ error: "This suggestion has already been recognized" }, { status: 409 })
  }

  const recognition = await prisma.recognition.create({
    data: {
      organizationId: session.organizationId,
      recipientId,
      grantedById: session.userId,
      message: message.trim(),
      visibility: validVisibility,
      suggestionId: suggestionId || null,
    },
    include: {
      recipient:  { select: { id: true, name: true } },
      grantedBy:  { select: { id: true, name: true } },
      suggestion: { select: { id: true, content: true } },
    },
  })

  return NextResponse.json(recognition, { status: 201 })
}
