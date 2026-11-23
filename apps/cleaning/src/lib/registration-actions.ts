"use server"

import { signUpSchema } from "./zod-schemas"
import { isPublicRegistrationEnabled } from "./registration"
import { registerTrialCompany } from "./data/registration"
import { ConflictError } from "./data/errors"
import { isEmailConfigured, sendEmail } from "./email"

export type SignUpResult = { error: string } | { ok: true } | undefined

function appBaseUrl(): string {
  return process.env.CLEANING_APP_URL?.replace(/\/$/, "") || "http://localhost:3000"
}

/**
 * Public self-service trial signup. Ships DARK — refuses unless
 * isPublicRegistrationEnabled(). In production it also refuses when email is not
 * configured (fail safe: never create an account we cannot send a verification
 * link to). On success it provisions a trial org + INACTIVE owner, emails a
 * verification link, and returns { ok: true } WITHOUT creating a session — the
 * owner must verify before they can sign in.
 */
export async function signUp(_prev: SignUpResult, formData: FormData): Promise<SignUpResult> {
  if (!isPublicRegistrationEnabled()) {
    return { error: "Self-service sign-up isn't open yet. Please contact CleanWare to get started." }
  }

  const parsed = signUpSchema.safeParse({
    orgName: formData.get("orgName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    timezone: formData.get("timezone"),
    trialTier: formData.get("trialTier") ?? undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form" }

  // Fail safe: in production a verification email MUST be deliverable, or we do
  // not create the account at all (it would be stranded inactive).
  if (process.env.NODE_ENV === "production" && !isEmailConfigured()) {
    return { error: "Sign-up is temporarily unavailable. Please try again later." }
  }

  let token: string
  let email: string
  let name: string
  try {
    ;({ token, email, name } = await registerTrialCompany(parsed.data))
  } catch (e) {
    if (e instanceof ConflictError) return { error: e.message }
    throw e
  }

  const link = `${appBaseUrl()}/verify-email?token=${token}`
  const result = await sendEmail({
    to: email,
    subject: "Verify your email to activate your CleanWare trial",
    text:
      `Hi ${name},\n\n` +
      `Welcome to CleanWare. Confirm your email to activate your 14-day trial:\n\n${link}\n\n` +
      `This link expires in 24 hours. If you didn't create this account, you can ignore this email.`,
  })

  // In production a hard send failure is surfaced so the person can retry; in dev
  // (no provider) sendEmail logs the link to the console and reports dev:true.
  if (!result.delivered && !result.dev) {
    return { error: "We couldn't send your verification email. Please try again in a moment." }
  }
  return { ok: true }
}
