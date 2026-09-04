import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { ASSET_TYPE, ASSET_STATUS } from "@/lib/constants"
import { format } from "date-fns"

function escape(v: unknown): string {
  const s = v == null ? "" : String(v)
  return `"${s.replace(/"/g, '""')}"`
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const assets = await prisma.asset.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { name: "asc" },
    include: {
      location:   { select: { name: true } },
      department: { select: { name: true } },
      vendor:     { select: { name: true } },
      _count:     { select: { issues: true } },
    },
  })

  const headers = ["ID", "Name", "Type", "Status", "Asset Tag", "Model", "Manufacturer", "Location", "Department", "Vendor", "Open Issues"]
  const rows = assets.map(a => [
    a.id,
    a.name,
    ASSET_TYPE[a.type as keyof typeof ASSET_TYPE] ?? a.type,
    ASSET_STATUS[a.status as keyof typeof ASSET_STATUS] ?? a.status,
    a.assetTag ?? "",
    a.model ?? "",
    a.manufacturer ?? "",
    a.location?.name ?? "",
    a.department?.name ?? "",
    a.vendor?.name ?? "",
    a._count.issues,
  ])

  const csv = [headers, ...rows].map(row => row.map(escape).join(",")).join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="assets-${format(new Date(), "yyyy-MM-dd")}.csv"`,
    },
  })
}
