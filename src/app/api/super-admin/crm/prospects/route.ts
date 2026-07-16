import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { NextRequest, NextResponse } from "next/server"
import { ProspectCrmStatus, ProspectSource } from "@/generated/prisma/enums"
import { Prisma } from "@/generated/prisma/client"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !session.superAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = req.nextUrl

  const status = searchParams.get("status") as ProspectCrmStatus | null
  const industry = searchParams.get("industry")
  const minScore = searchParams.get("minScore") ? parseInt(searchParams.get("minScore")!, 10) : undefined
  const maxScore = searchParams.get("maxScore") ? parseInt(searchParams.get("maxScore")!, 10) : undefined
  const hasContact = searchParams.get("hasContact") === "true"
  const search = searchParams.get("search")
  const sortBy = searchParams.get("sortBy") ?? "aiFitScore"
  const page = parseInt(searchParams.get("page") ?? "1", 10)
  const limit = parseInt(searchParams.get("limit") ?? "50", 10)

  const where: Prisma.ProspectWhereInput = {}

  if (status) {
    where.currentCrmStatus = status
  }

  if (industry) {
    where.industry = { contains: industry, mode: "insensitive" }
  }

  if (minScore !== undefined || maxScore !== undefined) {
    where.aiFitScore = {}
    if (minScore !== undefined) where.aiFitScore.gte = minScore
    if (maxScore !== undefined) where.aiFitScore.lte = maxScore
  }

  if (hasContact) {
    where.contacts = { some: {} }
  }

  if (search) {
    where.OR = [
      { companyName: { contains: search, mode: "insensitive" } },
      { industry: { contains: search, mode: "insensitive" } },
      { headquartersCity: { contains: search, mode: "insensitive" } },
    ]
  }

  const orderByField =
    sortBy === "lastOutreachDate"
      ? "lastOutreachDate"
      : sortBy === "createdAt"
      ? "createdAt"
      : "aiFitScore"

  const orderBy: Prisma.ProspectOrderByWithRelationInput = {
    [orderByField]: "desc",
  }

  const skip = (page - 1) * limit

  const [prospects, total] = await Promise.all([
    prisma.prospect.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        contacts: {
          select: {
            id: true,
            name: true,
            email: true,
            emailConfidence: true,
          },
          take: 1,
        },
        _count: {
          select: {
            contacts: true,
            notes: true,
          },
        },
      },
    }),
    prisma.prospect.count({ where }),
  ])

  const pages = Math.ceil(total / limit)

  return NextResponse.json({ prospects, total, page, pages })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !session.superAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const {
    companyName,
    website,
    industry,
    employeeCountMin,
    employeeCountMax,
    locationsCount,
    headquartersCity,
    headquartersState,
    source,
  } = body

  // Duplicate check 1: exact companyName match (case-insensitive)
  const nameMatch = await prisma.prospect.findFirst({
    where: { companyName: { equals: companyName, mode: "insensitive" } },
    select: { id: true, companyName: true, website: true, aiFitScore: true, currentCrmStatus: true },
  })

  if (nameMatch) {
    return NextResponse.json(
      {
        error: "Duplicate prospect",
        existing: {
          id: nameMatch.id,
          companyName: nameMatch.companyName,
          website: nameMatch.website,
          aiFitScore: nameMatch.aiFitScore,
          currentCrmStatus: nameMatch.currentCrmStatus,
        },
      },
      { status: 409 }
    )
  }

  // Duplicate check 2: website domain match
  if (website) {
    let domain: string | null = null
    try {
      const url = new URL(website.startsWith("http") ? website : `https://${website}`)
      // Strip www prefix for broader matching
      domain = url.hostname.replace(/^www\./, "")
    } catch {
      // unparseable URL — skip domain check
    }

    if (domain) {
      const domainMatch = await prisma.prospect.findFirst({
        where: { website: { contains: domain, mode: "insensitive" } },
        select: { id: true, companyName: true, website: true, aiFitScore: true, currentCrmStatus: true },
      })

      if (domainMatch) {
        return NextResponse.json(
          {
            error: "Duplicate prospect",
            existing: {
              id: domainMatch.id,
              companyName: domainMatch.companyName,
              website: domainMatch.website,
              aiFitScore: domainMatch.aiFitScore,
              currentCrmStatus: domainMatch.currentCrmStatus,
            },
          },
          { status: 409 }
        )
      }
    }
  }

  const prospect = await prisma.prospect.create({
    data: {
      companyName,
      website: website ?? null,
      industry: industry ?? null,
      employeeCountMin: employeeCountMin ?? null,
      employeeCountMax: employeeCountMax ?? null,
      locationsCount: locationsCount ?? null,
      headquartersCity: headquartersCity ?? null,
      headquartersState: headquartersState ?? null,
      source: (source as ProspectSource) ?? ProspectSource.manual,
    },
  })

  return NextResponse.json(prospect, { status: 201 })
}
