"use server"

import { redirect } from "next/navigation"
import { portalLogin, acceptPortalInvite } from "./data/portal"
import { systemDb } from "./org-db"
import { createPortalSession, deletePortalSession } from "./portal-session"

export type PortalAuthResult = { error: string } | undefined

export async function portalLoginAction(_prev: PortalAuthResult, formData: FormData): Promise<PortalAuthResult> {
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")
  if (!email || !password) return { error: "Email and password are required" }
  const user = await portalLogin(email, password)
  if (!user) return { error: "Invalid email or password" }
  await createPortalSession(user)
  redirect("/portal")
}

export async function portalAcceptAction(_prev: PortalAuthResult, formData: FormData): Promise<PortalAuthResult> {
  const token = String(formData.get("token") ?? "")
  const password = String(formData.get("password") ?? "")
  if (password.length < 8) return { error: "Choose a password of at least 8 characters" }
  const res = await acceptPortalInvite(token, password)
  if (!res) return { error: "This invite is invalid or has expired" }
  const user = await systemDb.user.findUnique({ where: { id: res.userId }, select: { id: true, email: true, name: true, customerId: true, organizationId: true } })
  if (!user || !user.customerId) return { error: "Could not activate your account" }
  await createPortalSession({ userId: user.id, email: user.email, name: user.name, customerId: user.customerId, organizationId: user.organizationId })
  redirect("/portal")
}

export async function portalLogout() {
  await deletePortalSession()
  redirect("/portal/login")
}
