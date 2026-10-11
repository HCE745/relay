import { requireAccountManager } from "@/lib/guards"
import { runWrite } from "@/lib/api"
import { rollbackImport } from "@/lib/data/imports"
const CAP = "operations.dataImport"
type Ctx = { params: Promise<{ id: string }> }
export async function POST(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  return runWrite(() => rollbackImport(g.orgId, id))
}
