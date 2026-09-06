"use server"

import bcrypt from "bcryptjs"
import { redirect } from "next/navigation"
import { prisma } from "./prisma"
import { createSession, deleteSession } from "./session"
import { loginSchema } from "./zod-schemas"
import { landingPathForRole } from "./rbac"

export type LoginResult = { error: string } | undefined

export async function login(_prev: LoginResult, formData: FormData): Promise<LoginResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) return { error: "Email and password are required" }
  const { email, password } = parsed.data

  const user = await prisma.user.findUnique({
    where: { email },
    include: { organization: { select: { packageTier: true, onboardingCompletedAt: true } } },
  })
  if (!user || !user.isActive) return { error: "Invalid credentials" }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return { error: "Invalid credentials" }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
    packageTier: user.organization.packageTier,
    onboardingCompleted: !!user.organization.onboardingCompletedAt,
  })

  redirect(landingPathForRole(user.role))
}

export async function logout() {
  await deleteSession()
  redirect("/login")
}
