import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { z } from "zod"
import { commitImport } from "@/lib/data/imports"
const CAP = "operations.dataImport"
export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(z.object({ csv: z.string().min(1).max(2_000_000), filename: z.string().max(200).optional() }), request); if (!body.ok) return body.response
  return runWrite(() => commitImport(g.orgId, body.data.csv, g.session.userId, body.data.filename), { created: true })
}
