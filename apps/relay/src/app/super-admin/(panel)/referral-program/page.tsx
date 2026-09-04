import { prisma } from "@/lib/prisma"
import { Gift } from "lucide-react"
import { ReferralProgramForm } from "@/components/referrals/referral-program-form"

export const dynamic = "force-dynamic"

export default async function ReferralProgramPage() {
  const programs = await prisma.referralProgram.findMany({ orderBy: { createdAt: "desc" } })
  const active   = programs.find(p => p.isActive) ?? null

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Gift className="w-6 h-6 text-indigo-400" />
        <h1 className="text-2xl font-bold text-white">Referral Program</h1>
      </div>

      {/* Active program indicator */}
      <div className={`mb-6 px-4 py-3 rounded-lg border text-sm ${active ? "bg-green-900/20 border-green-800 text-green-300" : "bg-yellow-900/20 border-yellow-800 text-yellow-300"}`}>
        {active
          ? <>Active program: <span className="font-semibold">{active.name}</span></>
          : "No active referral program — customers cannot see a referral card."}
      </div>

      {/* Existing programs list */}
      {programs.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Programs</h2>
          <div className="space-y-3">
            {programs.map(p => (
              <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{p.name}</span>
                    {p.isActive && (
                      <span className="text-[10px] px-2 py-0.5 bg-green-900/40 text-green-400 rounded-full font-semibold">ACTIVE</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 space-x-3">
                    <span>{p.consecutiveMonthsRequired}mo required</span>
                    <span>·</span>
                    <span>Referrer: {p.referrerRewardValue}× {p.referrerRewardCycles}mo</span>
                    <span>·</span>
                    <span>Referred: {p.referredRewardValue}× {p.referredRewardCycles}mo</span>
                    {p.maxRewardsPerOrg && <><span>·</span><span>Max {p.maxRewardsPerOrg}/org</span></>}
                  </div>
                </div>
                <EditProgramButton programId={p.id} isActive={p.isActive} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create / edit form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">
            {active ? "Edit Active Program" : "Create New Program"}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Saving with "Active" enabled will deactivate any other program.
          </p>
        </div>
        <div className="p-5">
          <ReferralProgramForm existing={active ? {
            id:                       active.id,
            name:                     active.name,
            isActive:                 active.isActive,
            cardTitle:                active.cardTitle,
            cardDescription:          active.cardDescription,
            programDescription:       active.programDescription,
            termsText:                active.termsText,
            ctaLabel:                 active.ctaLabel,
            linkBaseUrl:              active.linkBaseUrl,
            consecutiveMonthsRequired: active.consecutiveMonthsRequired,
            requireNewCustomer:       active.requireNewCustomer,
            allowDuringTrial:         active.allowDuringTrial,
            allowSelfReferral:        active.allowSelfReferral,
            allowRelatedOrgs:         active.allowRelatedOrgs,
            pauseOnFailedPayment:     active.pauseOnFailedPayment,
            resetClockOnCancellation: active.resetClockOnCancellation,
            maxRewardsPerOrg:         active.maxRewardsPerOrg,
            maxRewardsPerYear:        active.maxRewardsPerYear,
            referrerRewardValue:      active.referrerRewardValue,
            referrerRewardCycles:     active.referrerRewardCycles,
            referredRewardValue:      active.referredRewardValue,
            referredRewardCycles:     active.referredRewardCycles,
            showOnDashboard:          active.showOnDashboard,
            showInMobileApp:          active.showInMobileApp,
            qualificationExplanation: active.qualificationExplanation,
            successMessage:           active.successMessage,
            pendingRewardMessage:     active.pendingRewardMessage,
            disqualificationMessage:  active.disqualificationMessage,
          } : null} />
        </div>
      </div>
    </div>
  )
}

function EditProgramButton({ programId, isActive }: { programId: string; isActive: boolean }) {
  void programId
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${isActive ? "border-green-800 text-green-500" : "border-gray-700 text-gray-500"}`}>
      {isActive ? "Active" : "Inactive"}
    </span>
  )
}
