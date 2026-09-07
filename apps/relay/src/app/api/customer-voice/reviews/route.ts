import "server-only"
import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status         = searchParams.get("status")   ?? undefined
  const classification = searchParams.get("classification") ?? undefined
  const category       = searchParams.get("category") ?? undefined
  const ratingMin      = searchParams.get("ratingMin") ? Number(searchParams.get("ratingMin")) : undefined
  const ratingMax      = searchParams.get("ratingMax") ? Number(searchParams.get("ratingMax")) : undefined
  const dateFrom       = searchParams.get("dateFrom")  ? new Date(searchParams.get("dateFrom")!) : undefined
  const dateTo         = searchParams.get("dateTo")    ? new Date(searchParams.get("dateTo")!)   : undefined
  const page           = Math.max(1, Number(searchParams.get("page") ?? "1"))
  const pageSize       = 20

  const where = {
    organizationId: session.organizationId,
    ...(status         ? { status }                                   : {}),
    ...(classification ? { aiClassification: classification }         : {}),
    ...(category       ? { aiCategory: category }                     : {}),
    ...(ratingMin !== undefined || ratingMax !== undefined
      ? { rating: { ...(ratingMin !== undefined ? { gte: ratingMin } : {}), ...(ratingMax !== undefined ? { lte: ratingMax } : {}) } }
      : {}),
    ...(dateFrom || dateTo
      ? { publishedAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
      : {}),
  }

  const [reviews, total] = await Promise.all([
    prisma.customerReview.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip:    (page - 1) * pageSize,
      take:    pageSize,
      include: { location: { select: { id: true, name: true } } },
    }),
    prisma.customerReview.count({ where }),
  ])

  return NextResponse.json({ reviews, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}
