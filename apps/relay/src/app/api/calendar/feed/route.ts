import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildICS } from "@/lib/ics"

export const dynamic = "force-dynamic"

// GET /api/calendar/feed?token=XXX  — personal ICS feed, no auth cookie required
// Subscribe via webcal://yourdomain.com/api/calendar/feed?token=XXX in any calendar app
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  if (!token) return new NextResponse("Missing token", { status: 400 })

  const user = await prisma.user.findUnique({
    where: { calendarToken: token },
    select: { id: true, name: true, organizationId: true },
  })
  if (!user) return new NextResponse("Invalid token", { status: 404 })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""

  const issues = await prisma.issue.findMany({
    where: {
      assignedToId: user.id,
      organizationId: user.organizationId,
      dueDate: { not: null },
      status: { not: "RESOLVED" },
    },
    select: { id: true, title: true, description: true, dueDate: true, category: true },
    orderBy: { dueDate: "asc" },
  })

  const schedules = await prisma.maintenanceSchedule.findMany({
    where: { assignedToId: user.id, organizationId: user.organizationId, isActive: true },
    select: { id: true, title: true, description: true, nextDueAt: true },
    orderBy: { nextDueAt: "asc" },
  })

  const events = [
    ...issues.map(i => ({
      uid: `issue-${i.id}@relay`,
      summary: `[Issue] ${i.title}`,
      description: i.description ?? undefined,
      dtStart: i.dueDate!,
      url: `${baseUrl}/issues/${i.id}`,
    })),
    ...schedules.map(s => ({
      uid: `maintenance-${s.id}@relay`,
      summary: `[Maintenance] ${s.title}`,
      description: s.description ?? undefined,
      dtStart: s.nextDueAt,
    })),
  ]

  const ics = buildICS(events, "Relay — My Tasks")
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="relay-tasks.ics"`,
      "Cache-Control": "no-cache",
    },
  })
}
