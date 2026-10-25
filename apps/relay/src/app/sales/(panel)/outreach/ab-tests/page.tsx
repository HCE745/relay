import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { AbTestsClient } from "./AbTestsClient"

export const dynamic = "force-dynamic"

export default async function AbTestsPage() {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) redirect("/sales/login")

  const campaigns = await prisma.abTestCampaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      results: { orderBy: { variant: "asc" } },
      _count:  { select: { emails: true } },
    },
  })

  const templates = await prisma.crmEmailTemplate.findMany({
    orderBy: { name: "asc" },
    select:  { id: true, name: true, subject: true, body: true },
  })

  return <AbTestsClient campaigns={campaigns as never} templates={templates} />
}
