import { requireSession } from "@/lib/guards"
import { parseBody, ok, badRequest } from "@/lib/api"
import { changePasswordSchema } from "@/lib/zod-schemas"
import { changePassword } from "@/lib/data/auth-tokens"

// Authenticated self-service password change (verifies the current password).
export async function PATCH(request: Request) {
  const g = await requireSession()
  if (!g.ok) return g.response
  const body = await parseBody(changePasswordSchema, request)
  if (!body.ok) return body.response
  const oked = await changePassword(g.userId, body.data.currentPassword, body.data.newPassword)
  if (!oked) return badRequest("Your current password is incorrect.")
  return ok({ ok: true })
}
