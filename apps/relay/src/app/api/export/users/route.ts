import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { USER_ROLE } from "@/lib/constants"
import { format } from "date-fns"

function escape(v: unknown): string {
  const s = v == null ? "" : String(v)
  return `"${s.replace(/"/g, '""')}"`
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "HR", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { name: "asc" },
    include: {
      department: { select: { name: true } },
      location:   { select: { name: true } },
      manager:    { select: { name: true } },
      _count:     { select: { assignedIssues: true, reportedIssues: true } },
    },
  })

  const headers = ["Name", "Email", "Role", "Status", "Department", "Location", "Manager", "Assigned Issues", "Reported Issues", "Last Login", "Joined"]
  const rows = users.map(u => [
    u.name,
    u.email,
    USER_ROLE[u.role as keyof typeof USER_ROLE] ?? u.role,
    u.isActive ? "Active" : "Inactive",
    u.department?.name ?? "",
    u.location?.name ?? "",
    u.manager?.name ?? "",
    u._count.assignedIssues,
    u._count.reportedIssues,
    u.lastLoginAt ? format(new Date(u.lastLoginAt), "yyyy-MM-dd HH:mm") : "",
    format(new Date(u.createdAt), "yyyy-MM-dd"),
  ])

  const csv = [headers, ...rows].map(row => row.map(escape).join(",")).join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="team-${format(new Date(), "yyyy-MM-dd")}.csv"`,
    },
  })
}
