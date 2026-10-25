export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const campaigns = await prisma.abTestCampaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      results: true,
      _count: { select: { emails: true } },
    },
  })

  return NextResponse.json(campaigns)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json() as {
    name: string
    description?: string
    variants: Array<{ label: string; subject: string; body: string }>
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }
  if (!Array.isArray(body.variants) || body.variants.length < 2) {
    return NextResponse.json({ error: "At least 2 variants required" }, { status: 400 })
  }

  const campaign = await prisma.abTestCampaign.create({
    data: {
      name:                 body.name.trim(),
      description:          body.description ?? null,
      variants:             body.variants,
      createdBySAId:        session.superAdminId ?? null,
      createdBySalesUserId: session.salesUserId ?? null,
    },
  })

  // Pre-create result rows for each variant
  const LABELS = ["A", "B", "C", "D"]
  await prisma.abTestResult.createMany({
    data: body.variants.map((_v, i) => ({
      campaignId: campaign.id,
      variant:    LABELS[i],
    })),
  })

  return NextResponse.json(campaign, { status: 201 })
}
