import { requireSession } from "@/lib/guards"
import { ok, forbidden } from "@/lib/api"
import { experienceForRole } from "@/lib/rbac"
import { getOrgCapabilities } from "@/lib/entitlements-server"
import { globalSearch } from "@/lib/data/search"

// Command-palette search. Admin experience only (cleaners use the field app and
// never reach this). Results are scoped by role + capability in globalSearch.
export async function GET(request: Request) {
  const g = await requireSession()
  if (!g.ok) return g.response
  if (experienceForRole(g.session.role) !== "admin") return forbidden()
  const q = new URL(request.url).searchParams.get("q") ?? ""
  if (!q.trim()) return ok([])
  const caps = new Set(await getOrgCapabilities(g.orgId))
  const results = await globalSearch(g.orgId, q, { role: g.session.role, has: (c) => caps.has(c) })
  return ok(results)
}
