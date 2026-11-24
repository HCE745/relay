import { requireOrgAdmin } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { inventoryPolicySchema } from "@/lib/zod-schemas"
import { orgDb } from "@/lib/org-db"
export async function PATCH(request: Request) {
  const g = await requireOrgAdmin(); if (!g.ok) return g.response
  const b = await parseBody(inventoryPolicySchema, request); if (!b.ok) return b.response
  return runWrite(async () => { await orgDb(g.orgId).organization.update({ where: { id: g.orgId }, data: b.data }); return { updated: true } })
}
