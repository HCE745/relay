import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { ISSUE_STATUS, ISSUE_PRIORITY, ISSUE_CATEGORY, ASSET_TYPE } from "@/lib/constants"

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  if (q.length < 2) return NextResponse.json({ issues: [], assets: [], vendors: [], sops: [] })

  const orgId = session.organizationId

  const [issues, assets, vendors, sops] = await Promise.all([
    prisma.issue.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, status: true, priority: true, category: true },
    }),
    prisma.asset.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { assetTag: { contains: q, mode: "insensitive" } },
          { model: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, name: true, type: true, status: true },
    }),
    prisma.vendor.findMany({
      where: {
        organizationId: orgId,
        name: { contains: q, mode: "insensitive" },
      },
      take: 5,
      select: { id: true, name: true, specialty: true },
    }),
    prisma.sOP.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, title: true, category: true },
    }),
  ])

  return NextResponse.json({
    issues: issues.map(i => ({
      id: i.id,
      title: i.title,
      subtitle: `${ISSUE_PRIORITY[i.priority as keyof typeof ISSUE_PRIORITY] ?? i.priority} · ${ISSUE_STATUS[i.status as keyof typeof ISSUE_STATUS] ?? i.status} · ${ISSUE_CATEGORY[i.category as keyof typeof ISSUE_CATEGORY] ?? i.category}`,
      href: `/issues/${i.id}`,
    })),
    assets: assets.map(a => ({
      id: a.id,
      title: a.name,
      subtitle: ASSET_TYPE[a.type as keyof typeof ASSET_TYPE] ?? a.type,
      href: `/assets`,
    })),
    vendors: vendors.map(v => ({
      id: v.id,
      title: v.name,
      subtitle: v.specialty ?? "Vendor",
      href: `/vendors`,
    })),
    sops: sops.map(s => ({
      id: s.id,
      title: s.title,
      subtitle: s.category ?? "SOP",
      href: `/sops`,
    })),
  })
}
