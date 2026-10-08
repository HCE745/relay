import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, ok } from "@/lib/api"
import { jobPostingCreateSchema } from "@/lib/zod-schemas"
import { listJobPostings, createJobPosting } from "@/lib/data/hiring"
const CAP = "workforce.hiring"
export async function GET() {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  return ok(await listJobPostings(g.orgId))
}
export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(jobPostingCreateSchema, request); if (!body.ok) return body.response
  return runWrite(() => createJobPosting(g.orgId, body.data), { created: true })
}
