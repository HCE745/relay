import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { logSAAction } from "@/lib/sa-audit"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const programs = await prisma.referralProgram.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json({ programs })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as Partial<{
    name: string; isActive: boolean
    cardTitle: string; cardDescription: string; programDescription: string
    termsText: string; ctaLabel: string; linkBaseUrl: string
    consecutiveMonthsRequired: number; requireNewCustomer: boolean
    allowDuringTrial: boolean; allowSelfReferral: boolean; allowRelatedOrgs: boolean
    pauseOnFailedPayment: boolean; resetClockOnCancellation: boolean
    minimumPlan: string | null; excludedPlans: string[]
    maxRewardsPerOrg: number | null; maxRewardsPerYear: number | null
    programStartDate: string | null; programEndDate: string | null
    referrerRewardType: string; referrerRewardValue: number
    referrerRewardAppliesTo: string; referrerRewardCycles: number; referrerSchedulingType: string
    referredRewardType: string; referredRewardValue: number
    referredRewardAppliesTo: string; referredRewardCycles: number; referredSchedulingType: string
    showOnDashboard: boolean; showOnBillingPage: boolean
    showInSettings: boolean; showInMobileApp: boolean; visibleToRoles: string[]
    qualificationExplanation: string; successMessage: string
    pendingRewardMessage: string; disqualificationMessage: string
  }>

  // If activating this program, deactivate all others first
  if (body.isActive) {
    await prisma.referralProgram.updateMany({ data: { isActive: false } })
  }

  const program = await prisma.referralProgram.create({
    data: {
      name:                      body.name ?? "Standard Referral Program",
      isActive:                  body.isActive ?? false,
      cardTitle:                 body.cardTitle ?? "Earn Free Months",
      cardDescription:           body.cardDescription ?? "",
      programDescription:        body.programDescription ?? "",
      termsText:                 body.termsText ?? "",
      ctaLabel:                  body.ctaLabel ?? "Copy Referral Link",
      linkBaseUrl:               body.linkBaseUrl ?? "https://app.getrelay.software/signup?ref=",
      consecutiveMonthsRequired: body.consecutiveMonthsRequired ?? 6,
      requireNewCustomer:        body.requireNewCustomer ?? true,
      allowDuringTrial:          body.allowDuringTrial ?? true,
      allowSelfReferral:         body.allowSelfReferral ?? false,
      allowRelatedOrgs:          body.allowRelatedOrgs ?? false,
      pauseOnFailedPayment:      body.pauseOnFailedPayment ?? true,
      resetClockOnCancellation:  body.resetClockOnCancellation ?? true,
      minimumPlan:               body.minimumPlan ?? null,
      excludedPlans:             body.excludedPlans ?? [],
      maxRewardsPerOrg:          body.maxRewardsPerOrg ?? null,
      maxRewardsPerYear:         body.maxRewardsPerYear ?? null,
      programStartDate:          body.programStartDate ? new Date(body.programStartDate) : null,
      programEndDate:            body.programEndDate   ? new Date(body.programEndDate)   : null,
      referrerRewardType:        (body.referrerRewardType  ?? "free_billing_cycles") as never,
      referrerRewardValue:       body.referrerRewardValue  ?? 1,
      referrerRewardAppliesTo:   (body.referrerRewardAppliesTo ?? "entire_invoice") as never,
      referrerRewardCycles:      body.referrerRewardCycles ?? 1,
      referrerSchedulingType:    (body.referrerSchedulingType ?? "immediate") as never,
      referredRewardType:        (body.referredRewardType  ?? "free_billing_cycles") as never,
      referredRewardValue:       body.referredRewardValue  ?? 1,
      referredRewardAppliesTo:   (body.referredRewardAppliesTo ?? "entire_invoice") as never,
      referredRewardCycles:      body.referredRewardCycles ?? 1,
      referredSchedulingType:    (body.referredSchedulingType ?? "immediate") as never,
      showOnDashboard:           body.showOnDashboard   ?? true,
      showOnBillingPage:         body.showOnBillingPage ?? false,
      showInSettings:            body.showInSettings    ?? false,
      showInMobileApp:           body.showInMobileApp   ?? true,
      visibleToRoles:            body.visibleToRoles    ?? ["ADMIN", "MANAGER"],
      qualificationExplanation:  body.qualificationExplanation ?? "",
      successMessage:            body.successMessage    ?? "",
      pendingRewardMessage:      body.pendingRewardMessage ?? "",
      disqualificationMessage:   body.disqualificationMessage ?? "",
    },
  })

  await logSAAction({
    superAdminId: session.superAdminId, superAdminName: session.name,
    action: "CREATE_REFERRAL_PROGRAM", orgId: "", orgName: "",
    targetType: "other", targetId: program.id, targetName: program.name,
    after: { isActive: program.isActive },
  })

  return NextResponse.json({ program }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as { id: string } & Record<string, unknown>
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const existing = await prisma.referralProgram.findUnique({ where: { id: body.id } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // If activating, deactivate others
  if (body.isActive === true) {
    await prisma.referralProgram.updateMany({ where: { id: { not: body.id } }, data: { isActive: false } })
  }

  const { id, ...rest } = body
  // Convert date strings
  const data: Record<string, unknown> = { ...rest }
  if (typeof data.programStartDate === "string") data.programStartDate = new Date(data.programStartDate)
  if (typeof data.programEndDate   === "string") data.programEndDate   = new Date(data.programEndDate)
  if (data.programStartDate === null) data.programStartDate = null
  if (data.programEndDate   === null) data.programEndDate   = null

  const program = await prisma.referralProgram.update({ where: { id }, data: data as never })

  await logSAAction({
    superAdminId: session.superAdminId, superAdminName: session.name,
    action: "UPDATE_REFERRAL_PROGRAM", orgId: "", orgName: "",
    targetType: "other", targetId: id, targetName: existing.name,
    before: { isActive: existing.isActive }, after: { isActive: program.isActive, ...rest },
  })

  return NextResponse.json({ program })
}
