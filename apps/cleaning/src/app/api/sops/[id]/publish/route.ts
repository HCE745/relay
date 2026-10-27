import { requireAccountManager } from "@/lib/guards"
import { runWrite } from "@/lib/api"
import { publishSop } from "@/lib/data/sops"

const CAP = "operations.sopLibrary"
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  return runWrite(() => publishSop(g.orgId, id))
}
