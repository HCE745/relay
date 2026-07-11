import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { content, photoUrl } = await req.json() as { content: string; photoUrl?: string }

  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 })

  const assignment = await prisma.assignment.findFirst({
    where: { id, orgId: session.organizationId },
  })
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const comment = await prisma.assignmentComment.create({
    data: {
      assignmentId: id,
      authorId:     session.userId,
      content:      content.trim(),
      photoUrl,
    },
    include: { author: { select: { id: true, name: true, role: true } } },
  })

  return NextResponse.json({ comment }, { status: 201 })
}
