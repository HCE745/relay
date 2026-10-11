import { requireAccountManager } from "@/lib/guards"
import { ok } from "@/lib/api"
import { listImportBatches } from "@/lib/data/imports"
const CAP = "operations.dataImport"
export async function GET() {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  return ok(await listImportBatches(g.orgId))
}
