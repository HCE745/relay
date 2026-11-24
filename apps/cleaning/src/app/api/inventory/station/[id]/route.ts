import { requireStaff } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { stationLogSchema } from "@/lib/zod-schemas"
import { submitStationLog } from "@/lib/data/inventory"
const CAP = "supplies.inventory"
type Ctx = { params: Promise<{ id: string }> }
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireStaff(CAP); if (!g.ok) return g.response
  const { id } = await params
  const b = await parseBody(stationLogSchema, request); if (!b.ok) return b.response
  return runWrite(() => submitStationLog(g.orgId, id, g.userId, b.data.lines))
}
