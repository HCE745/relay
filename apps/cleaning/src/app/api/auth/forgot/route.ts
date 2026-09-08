import { parseBody, ok } from "@/lib/api"
import { forgotPasswordSchema } from "@/lib/zod-schemas"
import { createPasswordReset } from "@/lib/data/auth-tokens"
import { sendEmail } from "@/lib/email"

// Public. Always returns ok (never reveals whether an account exists).
export async function POST(request: Request) {
  const body = await parseBody(forgotPasswordSchema, request)
  if (!body.ok) return body.response

  const result = await createPasswordReset(body.data.email)
  if (result) {
    const origin = new URL(request.url).origin
    const link = `${process.env.CLEANING_APP_URL || origin}/reset-password?token=${result.token}`
    await sendEmail({
      to: result.email,
      subject: "Reset your HCE Cleaning password",
      text: `Hi ${result.name},\n\nReset your password using this link (valid for 1 hour):\n${link}\n\nIf you didn't request this, you can ignore this email.`,
    })
  }
  return ok({ ok: true })
}
