"use server"

import bcrypt from "bcryptjs"
import crypto from "crypto"
import { redirect } from "next/navigation"
import { systemDb } from "./org-db"
import { createSession } from "./session"
import { registerOrgSchema } from "./zod-schemas"

export type RegisterResult = { error: string } | undefined

// Token-gated organization bootstrap. Requires CLEANING_BOOTSTRAP_TOKEN to be
// set (registration is disabled otherwise) — this is the sales-assisted model:
// the founder shares the setup code with a new customer, preventing uncontrolled
// duplicate org creation while needing no developer/SQL step.
export async function registerOrg(_prev: RegisterResult, formData: FormData): Promise<RegisterResult> {
  const parsed = registerOrgSchema.safeParse({
    orgName: formData.get("orgName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    timezone: formData.get("timezone"),
    bootstrapToken: formData.get("bootstrapToken"),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form" }

  const expected = process.env.CLEANING_BOOTSTRAP_TOKEN
  if (!expected) return { error: "Registration is not currently enabled. Contact your provider." }
  if (parsed.data.bootstrapToken !== expected) return { error: "Invalid setup code." }

  const { orgName, name, email, password, timezone } = parsed.data
  const existing = await systemDb.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) return { error: "That email is already in use." }

  const slug =
    orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    crypto.randomBytes(3).toString("hex")

  const org = await systemDb.organization.create({
    data: {
      name: orgName,
      slug,
      packageTier: "TEAM",
      subscriptionStatus: "active",
      onboardingCompletedAt: new Date(),
      timezone,
    },
  })
  const user = await systemDb.user.create({
    data: { organizationId: org.id, name, email, password: await bcrypt.hash(password, 10), role: "OWNER" },
  })

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: "OWNER",
    organizationId: org.id,
    packageTier: "TEAM",
    onboardingCompleted: true,
  })
  redirect("/dashboard")
}
