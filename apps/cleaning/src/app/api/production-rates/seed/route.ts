import { requireAccountManager } from "@/lib/guards"
import { runWrite } from "@/lib/api"
import { seedDefaultProductionRates } from "@/lib/data/production-rates"

const CAP = "crm.bidCalculator"

export async function POST() {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  return runWrite(() => seedDefaultProductionRates(g.orgId))
}
