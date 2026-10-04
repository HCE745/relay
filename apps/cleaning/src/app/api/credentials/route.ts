import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, ok } from "@/lib/api"
import { credentialCreateSchema } from "@/lib/zod-schemas"
import { listCredentials, createCredential } from "@/lib/data/credentials"

const CAP = "workforce.compliance"

export async function GET() {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  return ok(await listCredentials(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(credentialCreateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => createCredential(g.orgId, body.data), { created: true })
}
