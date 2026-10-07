"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createDemoOrg, DemoLimitError, type DemoOwner } from "./provision"
import { createDemoSession, getDemoSession, deleteDemoSession } from "../demo-session"
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
    throw e
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
