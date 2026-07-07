import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { CalendarClient } from "./calendar-client"

export const dynamic = "force-dynamic"

export default async function CalendarPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const orgId = session.organizationId
  const isAdminLevel = ["ADMIN", "MANAGER"].includes(session.role)

  const [issues, schedules, locations, users, currentUser] = await Promise.all([
    prisma.issue.findMany({
      where: { organizationId: orgId, dueDate: { not: null }, status: { not: "RESOLVED" } },
      select: {
        id: true, title: true, dueDate: true, priority: true, status: true, category: true,
        assignedTo: { select: { id: true, name: true } },
        reportedBy: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.maintenanceSchedule.findMany({
      where: { organizationId: orgId, isActive: true },
      include: {
        location: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { nextDueAt: "asc" },
    }),
    prisma.location.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    isAdminLevel
      ? prisma.user.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
    prisma.user.findUnique({ where: { id: session.userId }, select: { calendarToken: true } }),
  ])

  return (
    <div>
      <Header title="Calendar" />
      <div className="p-4 md:p-6">
        <CalendarClient
          issues={issues.map(i => ({
            ...i,
            dueDate: i.dueDate!.toISOString(),
          }))}
          schedules={schedules.map(s => ({
            ...s,
            nextDueAt: s.nextDueAt.toISOString(),
            createdAt: s.createdAt.toISOString(),
            updatedAt: s.updatedAt.toISOString(),
            location: s.location ?? null,
            assignedTo: s.assignedTo ?? null,
          }))}
          locations={locations}
          users={users}
          isAdminLevel={isAdminLevel}
          userId={session.userId}
          calendarToken={currentUser?.calendarToken ?? null}
          appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ""}
        />
      </div>
    </div>
  )
}
