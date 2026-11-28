import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { requireWizardAccess, WizardAccessError } from "@/lib/onboarding-wizard"
import { defaultProgress, type WizardProgress, type FrontlineAuthPrefs } from "@/lib/wizard-steps"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

function wizardError(e: unknown) {
  if (e instanceof WizardAccessError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error("[frontline-auth-prefs]", e)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

// GET /api/super-admin/onboarding/[id]/frontline-auth-prefs
// Returns the frontlineAuthPrefs section of the wizardProgress JSON.
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params

  try { await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const record = await prisma.customerOnboarding.findUnique({
    where:  { id },
    select: { wizardProgress: true },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const progress = (record.wizardProgress ?? defaultProgress()) as WizardProgress
  return NextResponse.json({ prefs: progress.frontlineAuthPrefs ?? null })
}

// PUT /api/super-admin/onboarding/[id]/frontline-auth-prefs
// Saves frontlineAuthPrefs into the wizardProgress JSON without touching other fields.
export async function PUT(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params

  try { await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const body = await req.json() as { prefs?: FrontlineAuthPrefs }
  if (!body.prefs || typeof body.prefs !== "object") {
    return NextResponse.json({ error: "Missing prefs" }, { status: 400 })
  }

  const record = await prisma.customerOnboarding.findUnique({
    where:  { id },
    select: { wizardProgress: true },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const progress = (record.wizardProgress ?? defaultProgress()) as WizardProgress
  const updated: WizardProgress = {
    ...progress,
    frontlineAuthPrefs: body.prefs,
    lastSavedAt: new Date().toISOString(),
  }

  await prisma.customerOnboarding.update({
    where: { id },
    data:  { wizardProgress: updated as object },
  })

  return NextResponse.json({ ok: true })
}
