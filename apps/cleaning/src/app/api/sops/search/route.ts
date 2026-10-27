import { requireSession } from "@/lib/guards"
import { ok, forbidden } from "@/lib/api"
import { orgHasCapability } from "@/lib/page-guards"
import { searchSections } from "@/lib/data/sops"
const CAP = "operations.sopLibrary"
export async function GET(request: Request) {
  const g = await requireSession(); if (!g.ok) return g.response
  if (!(await orgHasCapability(g.orgId, CAP))) return forbidden(`Missing capability: ${CAP}`)
  const q = new URL(request.url).searchParams.get("q") ?? ""
  return ok(await searchSections(g.orgId, q, { role: g.session.role }))
}
