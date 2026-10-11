import { requireAccountManager } from "@/lib/guards"
import { importTemplateCsv } from "@/lib/data/imports"
const CAP = "operations.dataImport"
export async function GET() {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  return new Response(importTemplateCsv(), { headers: { "content-type": "text/csv", "content-disposition": 'attachment; filename="customer-import-template.csv"' } })
}
