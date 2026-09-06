import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { contactCreateSchema } from "@/lib/zod-schemas"
import { createContact } from "@/lib/data/contacts"

const CAP = "core.customers"

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(contactCreateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => createContact(g.orgId, body.data), { created: true })
}
