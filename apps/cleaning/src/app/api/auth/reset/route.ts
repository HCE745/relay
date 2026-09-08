import { parseBody, ok, badRequest } from "@/lib/api"
import { resetPasswordSchema } from "@/lib/zod-schemas"
import { consumePasswordReset } from "@/lib/data/auth-tokens"

// Public. Consumes a single-use, expiring token (looked up by hash).
export async function POST(request: Request) {
  const body = await parseBody(resetPasswordSchema, request)
  if (!body.ok) return body.response
  const success = await consumePasswordReset(body.data.token, body.data.password)
  if (!success) return badRequest("This reset link is invalid or has expired.")
  return ok({ ok: true })
}
