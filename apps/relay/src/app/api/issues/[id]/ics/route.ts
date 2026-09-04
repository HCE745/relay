import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { buildICS } from "@/lib/ics"

export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { id } = await params
  const issue = await prisma.issue.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { id: true, title: true, description: true, dueDate: true, priority: true },
  })
  if (!issue) return new NextResponse("Not found", { status: 404 })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const dtStart = issue.dueDate ?? new Date()

  const ics = buildICS([{
    uid: `issue-${issue.id}@relay`,
    summary: `[Relay] ${issue.title}`,
    description: issue.description ?? undefined,
    dtStart,
    url: `${baseUrl}/issues/${issue.id}`,
  }])

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="relay-issue.ics"`,
    },
  })
}
