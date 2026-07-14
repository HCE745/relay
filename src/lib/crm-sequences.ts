import "server-only"
import { prisma } from "./prisma"
import type { CrmSequence, CrmSequenceStep } from "@/generated/prisma/client"

// ─── Default Sequence Definitions ─────────────────────────────────────────────

interface SequenceDef {
  name:          string
  description:   string
  isDefault:     boolean
  isSystem:      boolean
  stopOnReply:   boolean
  stopOnCustomer:boolean
  steps: {
    stepNumber:        number
    delayBusinessDays: number
    subjectBehavior:   string
    aiInstructions:    string
    requireApproval:   boolean
    autoSendAllowed:   boolean
  }[]
}

export const DEFAULT_SEQUENCES: SequenceDef[] = [
  {
    name:           "Cold Outreach",
    description:    "For prospects who have never heard of Relay. 5 touchpoints over ~2 months.",
    isDefault:      true,
    isSystem:       true,
    stopOnReply:    true,
    stopOnCustomer: true,
    steps: [
      {
        stepNumber:        1,
        delayBusinessDays: 4,
        subjectBehavior:   "re",
        requireApproval:   true,
        autoSendAllowed:   false,
        aiInstructions:    "First follow-up. Don't repeat the original pitch. Reference something specific about their multi-location or multi-shift operation. Offer a quick tour or a specific case study. Keep it to 3 sentences max.",
      },
      {
        stepNumber:        2,
        delayBusinessDays: 7,
        subjectBehavior:   "re",
        requireApproval:   true,
        autoSendAllowed:   false,
        aiInstructions:    "Second follow-up. Try a different angle — operational pain points, handoff issues, tracking issues across shifts or locations. Mention a specific Relay feature that addresses a likely pain point for this type of business. 3 sentences max.",
      },
      {
        stepNumber:        3,
        delayBusinessDays: 14,
        subjectBehavior:   "re",
        requireApproval:   true,
        autoSendAllowed:   false,
        aiInstructions:    "Third follow-up. This should be the most personal email yet. Reference their specific industry or operation size. Ask a genuine question about a challenge they likely face. No pitch. 2-3 sentences.",
      },
      {
        stepNumber:        4,
        delayBusinessDays: 30,
        subjectBehavior:   "new",
        requireApproval:   true,
        autoSendAllowed:   false,
        aiInstructions:    "Final follow-up. Tell them you will close the loop after this. Acknowledge they're busy. Leave the door open for later. Include the product tour link https://app.getrelay.software/tour. Do not pitch hard. Keep it gracious and brief — 2-3 sentences.",
      },
    ],
  },
  {
    name:           "Warm Lead",
    description:    "For prospects who have shown interest or been referred. Shorter cadence.",
    isDefault:      false,
    isSystem:       true,
    stopOnReply:    true,
    stopOnCustomer: true,
    steps: [
      {
        stepNumber:        1,
        delayBusinessDays: 2,
        subjectBehavior:   "re",
        requireApproval:   true,
        autoSendAllowed:   false,
        aiInstructions:    "Quick follow-up for someone who has shown interest. Acknowledge their interest. Offer a short call or a demo slot. Very brief — 2-3 sentences.",
      },
      {
        stepNumber:        2,
        delayBusinessDays: 5,
        subjectBehavior:   "re",
        requireApproval:   true,
        autoSendAllowed:   false,
        aiInstructions:    "Second touch for warm lead. Share a quick insight or case study relevant to their industry. Ask if now is still a good time. 2-3 sentences.",
      },
      {
        stepNumber:        3,
        delayBusinessDays: 14,
        subjectBehavior:   "re",
        requireApproval:   true,
        autoSendAllowed:   false,
        aiInstructions:    "Final touch for warm lead. Acknowledge if timing is off. Leave the door open. Offer a specific next step. 2 sentences.",
      },
    ],
  },
  {
    name:           "After Demo",
    description:    "For prospects who completed a demo. Keep momentum going.",
    isDefault:      false,
    isSystem:       true,
    stopOnReply:    true,
    stopOnCustomer: true,
    steps: [
      {
        stepNumber:        1,
        delayBusinessDays: 1,
        subjectBehavior:   "re",
        requireApproval:   true,
        autoSendAllowed:   false,
        aiInstructions:    "Post-demo follow-up, sent the next business day. Thank them for their time. Reference a specific pain point or question they raised during the demo. Suggest next step: trial, pricing call, or answer a specific question. Very warm and personal. 3-4 sentences.",
      },
      {
        stepNumber:        2,
        delayBusinessDays: 4,
        subjectBehavior:   "re",
        requireApproval:   true,
        autoSendAllowed:   false,
        aiInstructions:    "Second post-demo follow-up. Check in on any internal discussions. Offer to answer questions or do a team demo. Reference the specific feature that resonated most with them. 2-3 sentences.",
      },
      {
        stepNumber:        3,
        delayBusinessDays: 10,
        subjectBehavior:   "re",
        requireApproval:   true,
        autoSendAllowed:   false,
        aiInstructions:    "Third post-demo follow-up. This prospect is still evaluating. Share a brief relevant case study or outcome from a similar business. Make it easy to move forward. 3 sentences.",
      },
      {
        stepNumber:        4,
        delayBusinessDays: 21,
        subjectBehavior:   "re",
        requireApproval:   true,
        autoSendAllowed:   false,
        aiInstructions:    "Final post-demo follow-up. Acknowledge the time that has passed. Note the door is always open. If they are ready, here is how to start a trial. Brief and gracious — 2-3 sentences.",
      },
    ],
  },
  {
    name:           "Trial Check-In",
    description:    "For organizations on an active trial. Support adoption.",
    isDefault:      false,
    isSystem:       true,
    stopOnReply:    true,
    stopOnCustomer: true,
    steps: [
      {
        stepNumber:        1,
        delayBusinessDays: 3,
        subjectBehavior:   "new",
        requireApproval:   true,
        autoSendAllowed:   false,
        aiInstructions:    "Check in shortly after trial starts. Ask how setup is going. Offer to help with anything specific. Mention a key feature they should explore based on their pain points. 3 sentences.",
      },
      {
        stepNumber:        2,
        delayBusinessDays: 7,
        subjectBehavior:   "new",
        requireApproval:   true,
        autoSendAllowed:   false,
        aiInstructions:    "Mid-trial check-in. Ask if they have had a chance to log real issues or assign tasks. Share a quick tip. 2-3 sentences.",
      },
      {
        stepNumber:        3,
        delayBusinessDays: 12,
        subjectBehavior:   "new",
        requireApproval:   true,
        autoSendAllowed:   false,
        aiInstructions:    "Near end of trial. Gently note the trial is wrapping up soon. Ask what they think so far. Offer a pricing call or to extend if needed. 3 sentences.",
      },
    ],
  },
  {
    name:           "Renewal Follow-Up",
    description:    "For customers approaching renewal. Proactive relationship check.",
    isDefault:      false,
    isSystem:       true,
    stopOnReply:    true,
    stopOnCustomer: false,
    steps: [
      {
        stepNumber:        1,
        delayBusinessDays: 3,
        subjectBehavior:   "new",
        requireApproval:   true,
        autoSendAllowed:   false,
        aiInstructions:    "Proactive renewal check-in. Note the renewal is coming up. Ask how things have been going. Offer a quick call. Keep it personal and light — 3 sentences.",
      },
      {
        stepNumber:        2,
        delayBusinessDays: 7,
        subjectBehavior:   "re",
        requireApproval:   true,
        autoSendAllowed:   false,
        aiInstructions:    "Second renewal touch. If no reply. Mention any new features that have been added. Ask if there are any questions before renewal. 2-3 sentences.",
      },
    ],
  },
  {
    name:           "Customer Referral Request",
    description:    "Ask happy customers to refer other businesses.",
    isDefault:      false,
    isSystem:       true,
    stopOnReply:    true,
    stopOnCustomer: false,
    steps: [
      {
        stepNumber:        1,
        delayBusinessDays: 2,
        subjectBehavior:   "new",
        requireApproval:   true,
        autoSendAllowed:   false,
        aiInstructions:    "Ask a happy customer for a referral. Reference something specific about their positive experience with Relay. Keep it light and natural — not a transactional ask. Ask if they know of any similar businesses who might benefit. 3-4 sentences.",
      },
      {
        stepNumber:        2,
        delayBusinessDays: 10,
        subjectBehavior:   "re",
        requireApproval:   true,
        autoSendAllowed:   false,
        aiInstructions:    "Gentle follow-up on referral request. No pressure. If they have someone in mind, here is how the referral program works (https://app.getrelay.software/referrals). 2 sentences.",
      },
    ],
  },
  {
    name:           "Win-Back Campaign",
    description:    "For churned or expired trial customers. Re-engage after a gap.",
    isDefault:      false,
    isSystem:       true,
    stopOnReply:    true,
    stopOnCustomer: true,
    steps: [
      {
        stepNumber:        1,
        delayBusinessDays: 5,
        subjectBehavior:   "new",
        requireApproval:   true,
        autoSendAllowed:   false,
        aiInstructions:    "First win-back attempt. Acknowledge it has been a while. Mention any improvements or new features that have been added since they last used Relay. Make it easy to take another look. 3-4 sentences. Do not be pushy.",
      },
      {
        stepNumber:        2,
        delayBusinessDays: 20,
        subjectBehavior:   "new",
        requireApproval:   true,
        autoSendAllowed:   false,
        aiInstructions:    "Second win-back attempt. Different angle — ask if their operational challenges have changed. Offer a short call to see if Relay is now a fit. 2-3 sentences.",
      },
    ],
  },
]

// ─── Seed Helper ───────────────────────────────────────────────────────────────

/**
 * Seed default sequences if none exist yet.
 * Idempotent — safe to call multiple times.
 */
export async function seedDefaultSequences(): Promise<number> {
  const existing = await prisma.crmSequence.count()
  if (existing > 0) return 0

  for (const seq of DEFAULT_SEQUENCES) {
    const { steps, ...seqData } = seq
    const created = await prisma.crmSequence.create({ data: seqData })
    for (const step of steps) {
      await prisma.crmSequenceStep.create({
        data: { ...step, sequenceId: created.id },
      })
    }
  }

  return DEFAULT_SEQUENCES.length
}

/**
 * Get the active default sequence, or the first active sequence.
 */
export async function getDefaultSequence(): Promise<(CrmSequence & { steps: CrmSequenceStep[] }) | null> {
  await seedDefaultSequences()
  return prisma.crmSequence.findFirst({
    where:   { isActive: true, isDefault: true },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  }) ?? prisma.crmSequence.findFirst({
    where:   { isActive: true },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  })
}

/**
 * Enroll a DemoCall in a sequence after an initial email is sent.
 * Creates the enrollment record and schedules the first follow-up.
 */
export async function enrollInSequence({
  demoCallId,
  sequenceId,
  initialEmailId,
  mode,
  crmTimezone = "America/New_York",
  sendingWindowStart = 9,
  sendingWindowEnd   = 16,
}: {
  demoCallId:         string
  sequenceId:         string
  initialEmailId:     string
  mode:               string
  crmTimezone?:       string
  sendingWindowStart?:number
  sendingWindowEnd?:  number
}) {
  const { addBusinessDays } = await import("./business-days")

  const sequence = await prisma.crmSequence.findUnique({
    where:   { id: sequenceId },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  })
  if (!sequence || sequence.steps.length === 0) return null

  // Cancel any existing active enrollment for this demoCall + sequence
  await prisma.crmEmailSequenceEnrollment.updateMany({
    where: { demoCallId, sequenceId, status: "active" },
    data:  { status: "stopped", stopReason: "re-enrolled", stoppedAt: new Date() },
  })

  const firstStep = sequence.steps[0]
  const now       = new Date()
  const firstFollowUpAt = addBusinessDays(now, firstStep.delayBusinessDays, crmTimezone, sendingWindowStart, sendingWindowEnd)

  const enrollment = await prisma.crmEmailSequenceEnrollment.create({
    data: {
      demoCallId,
      sequenceId,
      currentStep:    0,
      status:         "active",
      mode,
      initialEmailId,
      lastEmailId:    initialEmailId,
      lastContactAt:  now,
      nextFollowUpAt: firstFollowUpAt,
      enrolledAt:     now,
    },
  })

  // Create first follow-up task
  await prisma.crmFollowUp.create({
    data: {
      enrollmentId: enrollment.id,
      stepNumber:   firstStep.stepNumber,
      status:       "pending",
      scheduledFor: firstFollowUpAt,
    },
  })

  return enrollment
}

/**
 * Schedule the next follow-up step after one step is sent.
 */
export async function scheduleNextStep({
  enrollment,
  completedStep,
  crmTimezone = "America/New_York",
  sendingWindowStart = 9,
  sendingWindowEnd   = 16,
}: {
  enrollment: { id: string; sequenceId: string; currentStep: number }
  completedStep: number
  crmTimezone?:  string
  sendingWindowStart?: number
  sendingWindowEnd?:   number
}): Promise<boolean> {
  const { addBusinessDays } = await import("./business-days")

  const nextStepDef = await prisma.crmSequenceStep.findUnique({
    where: { sequenceId_stepNumber: { sequenceId: enrollment.sequenceId, stepNumber: completedStep + 1 } },
  })

  if (!nextStepDef) {
    // No more steps — mark enrollment complete
    await prisma.crmEmailSequenceEnrollment.update({
      where: { id: enrollment.id },
      data:  { status: "completed", stoppedAt: new Date(), nextFollowUpAt: null },
    })
    return false
  }

  const now     = new Date()
  const nextAt  = addBusinessDays(now, nextStepDef.delayBusinessDays, crmTimezone, sendingWindowStart, sendingWindowEnd)

  await Promise.all([
    prisma.crmEmailSequenceEnrollment.update({
      where: { id: enrollment.id },
      data:  { currentStep: completedStep, nextFollowUpAt: nextAt, updatedAt: now },
    }),
    prisma.crmFollowUp.create({
      data: {
        enrollmentId: enrollment.id,
        stepNumber:   nextStepDef.stepNumber,
        status:       "pending",
        scheduledFor: nextAt,
      },
    }),
  ])

  return true
}
