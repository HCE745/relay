"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createDemoOrg, DemoLimitError, type DemoOwner } from "./provision"
import { createDemoSession, getDemoSession, deleteDemoSession } from "../demo-session"
import { DEMO_ROLES, type DemoRole } from "./roles"
import type { DemoMix } from "./seed"

type Result = { error: string } | undefined

async function clientIp(): Promise<string> {
  const h = await headers()
  const fwd = h.get("x-forwarded-for")
  return (fwd ? fwd.split(",")[0] : null)?.trim() || h.get("x-real-ip") || "0.0.0.0"
}

function parseMix(v: FormDataEntryValue | null): DemoMix {
  const n = Number(v)
  return (n >= 0 && n <= 4 ? n : 2) as DemoMix
}

async function startSession(d: DemoOwner) {
  await createDemoSession({
    userId: d.owner.id, email: d.owner.email, name: d.owner.name, role: "OWNER",
    organizationId: d.orgId, packageTier: "ENTERPRISE", onboardingCompleted: true,
  })
}

export async function enterDemo(_prev: Result, formData: FormData): Promise<Result> {
  const mix = parseMix(formData.get("mix"))
  try {
    const d = await createDemoOrg(await clientIp(), mix)
    await startSession(d)
  } catch (e) {
    if (e instanceof DemoLimitError) return { error: e.message }
    // TEMP DIAG: surface the real error in the response body for live debugging.
    const code = (e as { code?: string })?.code
    const name = (e as Error)?.name
    const msg = (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ").slice(0, 400)
    return { error: `DIAG name=${name} code=${code ?? "n/a"} msg=${msg}` }
  }
  redirect("/dashboard")
}

export async function reseedDemo(_prev: Result, formData: FormData): Promise<Result> {
  const session = await getDemoSession()
  if (!session) redirect("/demo")
  const mix = parseMix(formData.get("mix"))
  try {
    const d = await createDemoOrg(await clientIp(), mix, { replaceOrgId: session!.organizationId })
    await startSession(d)
  } catch (e) {
    if (e instanceof DemoLimitError) return { error: e.message }
    throw e
  }
  redirect("/dashboard")
}

export async function exitDemo() {
  await deleteDemoSession()
  redirect("/demo")
}

// ── Demo-only role/perspective switching ─────────────────────────────────────
// Re-issues the demo session as a seeded staff member of the requested role, so
// a visitor can experience the app's real permissions, navigation and dashboards
// for an Owner, Manager, Supervisor or Cleaner. HARD-GATED to demo sessions:
// there is no code path from a real staff session into this, and it only ever
// assumes an identity that already belongs to the visitor's own demo org.
export async function switchDemoRole(formData: FormData): Promise<void> {
  const session = await getDemoSession()
  if (!session) redirect("/demo")
  const role = String(formData.get("role") || "") as DemoRole
  if (!DEMO_ROLES.includes(role)) redirect("/dashboard")

  const { systemDb } = await import("../org-db")
  // Defense in depth: confirm the session's org really is a demo org before we
  // ever mint a session as one of its users.
  const org = await systemDb.organization.findFirst({
    where: { id: session!.organizationId, isDemo: true },
    select: { id: true, packageTier: true },
  })
  if (!org) redirect("/demo")

  const user = await systemDb.user.findFirst({
    where: { organizationId: org.id, role, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true },
  })
  // No seeded user for this role — stay where we are.
  if (!user) redirect(role === "CLEANER" ? "/today" : "/dashboard")

  await createDemoSession({
    userId: user.id, email: user.email, name: user.name, role,
    organizationId: org.id, packageTier: org.packageTier, onboardingCompleted: true,
  })
  // Cleaners live in the field app; everyone else in the admin workspace.
  redirect(role === "CLEANER" ? "/today" : "/dashboard")
}
