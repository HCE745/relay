import { getSession } from "@/lib/session"
import { getOrgCapabilities } from "@/lib/entitlements-server"
import { navForRole } from "@/lib/rbac"
import { ok, unauthorized, parseQuery } from "@/lib/api"
import { paginationSchema } from "@/lib/zod-schemas"

// Authenticated "who am I" endpoint. Demonstrates the standard route pattern:
// session guard → Zod-validated query → org-scoped capability resolution.
export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return unauthorized()

  const query = parseQuery(paginationSchema, request.url)
  if (!query.ok) return query.response

  const capabilities = await getOrgCapabilities(session.organizationId)
  const capSet = new Set(capabilities)
  const nav = navForRole(session.role, (cap) => capSet.has(cap))

  return ok({
    user: { id: session.userId, name: session.name, email: session.email, role: session.role },
    organizationId: session.organizationId,
    packageTier: session.packageTier,
    capabilities,
    nav,
    page: query.data,
  })
}
