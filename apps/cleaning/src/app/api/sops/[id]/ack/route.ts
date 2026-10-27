import { requireSession } from "@/lib/guards"
import { runWrite, forbidden } from "@/lib/api"
import { orgHasCapability } from "@/lib/page-guards"
import { acknowledgeSop } from "@/lib/data/sops"
const CAP = "operations.sopLibrary"
// Any reader (incl. CLEANER) can acknowledge; records against the current published version.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireSession(); if (!g.ok) return g.response
  if (!(await orgHasCapability(g.orgId, CAP))) return forbidden(`Missing capability: ${CAP}`)
  const { id } = await params
  return runWrite(() => acknowledgeSop(g.orgId, g.userId, id))
}
