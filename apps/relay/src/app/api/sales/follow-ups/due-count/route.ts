import { NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ count: 0 }, { status: 401 })

  const isManager = info.isManager || info.isSuperAdmin
  const userId = info.isSuperAdmin ? null : info.salesUserId

  const count = await prisma.crmEmail.count({
    where: {
      followUpDate:   { lte: new Date() },
      followUpDoneAt: null,
      isDeleted:      false,
      ...(!isManager && userId
        ? { sentBySalesUserId: userId }
        : {}),
    },
  })

  return NextResponse.json({ count })
}
