import "server-only"
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ingestReviews } from "@/lib/customer-voice"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Find all orgs with a connected Google Business Profile account
  const connectedAccounts = await prisma.connectedAccount.findMany({
    where: { provider: "google_business_profile" },
    select: { organizationId: true },
  })

  const results: Array<{ organizationId: string; result: unknown }> = []

  for (const { organizationId } of connectedAccounts) {
    try {
      const result = await ingestReviews(organizationId)
      results.push({ organizationId, result })
    } catch (err) {
      results.push({ organizationId, result: { error: String(err) } })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
