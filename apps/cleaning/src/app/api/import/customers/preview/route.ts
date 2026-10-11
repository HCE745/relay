import { requireAccountManager } from "@/lib/guards"
import { parseBody, ok } from "@/lib/api"
import { z } from "zod"
import { buildImportPreview } from "@/lib/data/imports"
const CAP = "operations.dataImport"
export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(z.object({ csv: z.string().min(1).max(2_000_000) }), request); if (!body.ok) return body.response
  return ok(await buildImportPreview(g.orgId, body.data.csv))
}
