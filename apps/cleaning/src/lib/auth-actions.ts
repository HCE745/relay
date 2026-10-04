"use server"

import { redirect } from "next/navigation"
import { prisma } from "./prisma"
import { createSession, deleteSession } from "./session"
import { loginSchema } from "./zod-schemas"
import { landingPathForRole } from "./rbac"
import { authenticate } from "./auth-core"

export type LoginResult = { error: string } | undefined

export async function login(_prev: LoginResult, formData: FormData): Promise<LoginResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) return { error: "Email and password are required" }
  const { email, password } = parsed.data

  const result = await authenticate(email, password)
  if (!result.ok) return { error: result.error }
  const user = result.user

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
    packageTier: user.packageTier,
    onboardingCompleted: user.onboardingCompleted,
  })
  redirect(landingPathForRole(user.role))
}

export async function logout() {
  await deleteSession()
  redirect("/login")
}
