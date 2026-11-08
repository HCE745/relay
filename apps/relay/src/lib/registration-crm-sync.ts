import "server-only"
import { prisma } from "./prisma"
export {
  extractEmailDomain,
  isPublicEmailDomain,
  normalizeCompanyName,
} from "./registration-crm-sync-pure"
export type { OnboardingStatus } from "./registration-crm-sync-pure"
import {
  extractEmailDomain,
  isPublicEmailDomain,
  normalizeCompanyName,
} from "./registration-crm-sync-pure"
import type { OnboardingStatus } from "./registration-crm-sync-pure"

// ── Match result types ────────────────────────────────────────────────────────
type MatchResult =
  | { kind: "exact";     prospectId: string }
  | { kind: "domain";    prospectId: string }
  | { kind: "contact";   prospectId: string }
  | { kind: "name";      prospectId: string }
  | { kind: "ambiguous" }  // multiple candidates — flag for manual review
  | { kind: "none" }

// ── Core matching logic ───────────────────────────────────────────────────────
// Priority: 1) already linked  2) domain match  3) contact email  4) name match
async function matchProspect(params: {
  adminEmail: string
  orgName: string
  domain: string | null
  excludeTestRecords?: boolean
}): Promise<MatchResult> {
  const { adminEmail, orgName, domain, excludeTestRecords = true } = params
  const baseWhere = excludeTestRecords ? { isTestRecord: false } : {}

  // 1. Business email domain match (skip public providers)
  if (domain && !isPublicEmailDomain(domain)) {
    const hits = await prisma.prospect.findMany({
      where: {
        ...baseWhere,
        relayOrganizationId: null,
        OR: [
          { website: { contains: domain, mode: "insensitive" } },
          {
            contacts: {
              some: { email: { endsWith: `@${domain}`, mode: "insensitive" } },
            },
          },
        ],
      },
      select: { id: true },
    })
    if (hits.length === 1) return { kind: "domain", prospectId: hits[0].id }
    if (hits.length > 1)  return { kind: "ambiguous" }
  }

  // 2. Contact email exact match
  const contactHit = await prisma.prospectContact.findFirst({
    where: {
      ...( excludeTestRecords ? { prospect: { isTestRecord: false } } : {}),
      email: { equals: adminEmail, mode: "insensitive" },
      prospect: { relayOrganizationId: null },
    },
    select: { prospectId: true },
  })
  if (contactHit) return { kind: "contact", prospectId: contactHit.prospectId }

  // 3. Company name fuzzy match
  const normalizedInput = normalizeCompanyName(orgName)
  if (normalizedInput.length >= 3) {
    const candidates = await prisma.prospect.findMany({
      where: { ...baseWhere, relayOrganizationId: null },
      select: { id: true, companyName: true },
    })
    const nameMatches = candidates.filter(c => normalizeCompanyName(c.companyName) === normalizedInput)
    if (nameMatches.length === 1) return { kind: "name", prospectId: nameMatches[0].id }
    if (nameMatches.length > 1)  return { kind: "ambiguous" }
  }

  return { kind: "none" }
}

// ── Round-robin assignment ────────────────────────────────────────────────────
// Returns the assigned SalesUser, or null if no eligible rep exists.
// Uses a serializable transaction for concurrency safety.
export async function assignInboundRep(): Promise<{ id: string; name: string; email: string } | null> {
  return prisma.$transaction(
    async (tx) => {
      // Load eligible reps: active, eligible, ordered oldest-assignment-first (nulls first)
      const eligible = await tx.salesUser.findMany({
        where: {
          inboundEligible: true,
          isActive: true,
          employmentStatus: "ACTIVE",
          isDemo: false,
        },
        orderBy: [
          { inboundLastAssignedAt: "asc" },
          { id: "asc" }, // stable tiebreaker
        ],
        select: { id: true, name: true, email: true },
      })

      if (eligible.length === 0) return null

      const winner = eligible[0]

      // Update timestamp atomically
      await tx.salesUser.update({
        where: { id: winner.id },
        data: { inboundLastAssignedAt: new Date() },
      })

      return winner
    },
    { isolationLevel: "Serializable" },
  )
}

// ── Notify admins about ambiguous company match ───────────────────────────────
async function notifyAmbiguousMatch(orgName: string, prospectId: string): Promise<void> {
  const admins = await prisma.salesUser.findMany({
    where: { role: "admin_sales", isActive: true },
    select: { id: true },
  })
  if (admins.length === 0) return
  await prisma.salesAlert.createMany({
    data: admins.map((a) => ({
      recipientId: a.id,
      type: "ambiguous_company_match",
      title: "Ambiguous Company Match on Registration",
      message: `"${orgName}" registered but matched multiple existing CRM prospects. A new record was created with duplicateFlag=true. Manual review and merge required.`,
      relatedId: prospectId,
    })),
    skipDuplicates: true,
  })
}

// ── Notify admins about unassigned inbound ────────────────────────────────────
async function notifyUnassignedInbound(orgName: string, prospectId: string): Promise<void> {
  const admins = await prisma.salesUser.findMany({
    where: { role: "admin_sales", isActive: true },
    select: { id: true },
  })
  if (admins.length === 0) return
  await prisma.salesAlert.createMany({
    data: admins.map((a) => ({
      recipientId: a.id,
      type: "unassigned_inbound",
      title: "Unassigned Inbound Registration",
      message: `${orgName} registered but no eligible sales rep is configured for round-robin. Manual assignment required.`,
      relatedId: prospectId,
    })),
    skipDuplicates: true,
  })
}

// ── Main sync entry point ─────────────────────────────────────────────────────
export async function syncRegistrationToCrm(params: {
  orgId: string
  orgName: string
  adminEmail: string
  adminName: string
  source?: string // "website_self_service" | "referral" | "invited" etc.
}): Promise<void> {
  const { orgId, orgName, adminEmail, adminName, source } = params

  // Load org to check demo/test status and idempotency
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { isDemo: true, crmProspectId: true },
  })

  if (!org) return
  if (org.isDemo) return // demo/test orgs bypass CRM sync
  if (org.crmProspectId) return // already synced (idempotent)

  const domain = extractEmailDomain(adminEmail)
  const now = new Date()
  const crmSource = source === "referral" ? ("referral" as const) : ("inbound" as const)

  const matchResult = await matchProspect({ adminEmail, orgName, domain })

  if (matchResult.kind === "ambiguous") {
    // ── Multiple prospects match — flag new record for manual review ──────────
    await createNewProspect({
      orgId, orgName, adminEmail, adminName, domain, crmSource, now,
      duplicateFlag: true,
    })
    return
  }

  if (matchResult.kind !== "none") {
    // ── Matched an existing prospect ──────────────────────────────────────────
    const { prospectId } = matchResult

    // Check this prospect isn't already linked to a different org
    const existing = await prisma.prospect.findUnique({
      where: { id: prospectId },
      select: { relayOrganizationId: true, assignedToId: true, assignedToName: true },
    })
    if (existing?.relayOrganizationId) {
      // Already linked to another org — create a new prospect instead
      await createNewProspect({ orgId, orgName, adminEmail, adminName, domain, crmSource, now })
      return
    }

    // Link prospect ↔ org
    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        relayOrganizationId: orgId,
        registeredAt: now,
        onboardingStatus: "not_started" as OnboardingStatus,
        onboardingLastActivityAt: now,
        currentCrmStatus: "trial",
      },
    })
    await prisma.organization.update({
      where: { id: orgId },
      data: { crmProspectId: prospectId },
    })

    // Record registration in prospect activity timeline
    await prisma.salesCrmActivity.create({
      data: {
        prospectId,
        activityType: "STATUS_CHANGED",
        subject: "Customer Registered",
        notes: `${adminName} (${adminEmail}) registered "${orgName}" via ${crmSource}. Linked to existing prospect record.`,
        occurredAt: now,
      },
    })

    // Ensure primary contact exists
    await ensureContact({ prospectId, adminEmail, adminName })

    // Record org-level lifecycle activity
    await prisma.crmActivity.create({
      data: {
        organizationId: orgId,
        eventType: "customer_registered",
        description: `Customer registered. Linked to existing CRM prospect (matched by ${matchResult.kind}).`,
        createdBySAName: "System",
      },
    })
  } else {
    // ── No match — create new prospect ────────────────────────────────────────
    await createNewProspect({ orgId, orgName, adminEmail, adminName, domain, crmSource, now })
  }
}


// ── Create a new prospect for an unmatched or ambiguous registration ──────────
async function createNewProspect(params: {
  orgId: string
  orgName: string
  adminEmail: string
  adminName: string
  domain: string | null
  crmSource: "inbound" | "referral"
  now: Date
  duplicateFlag?: boolean
}): Promise<void> {
  const { orgId, orgName, adminEmail, adminName, domain, crmSource, now, duplicateFlag = false } = params

  // Assign round-robin rep (skipped when flagged for review)
  const rep = duplicateFlag ? null : await assignInboundRep()

  const prospect = await prisma.prospect.create({
    data: {
      companyName: orgName,
      website: domain && !isPublicEmailDomain(domain) ? `https://${domain}` : null,
      source: crmSource,
      currentCrmStatus: "trial",
      relayOrganizationId: orgId,
      registeredAt: now,
      onboardingStatus: "not_started" as OnboardingStatus,
      onboardingLastActivityAt: now,
      assignedToId: rep?.id ?? null,
      assignedToName: rep?.name ?? null,
      duplicateFlag,
    },
  })

  // Link org back to prospect
  await prisma.organization.update({
    where: { id: orgId },
    data: { crmProspectId: prospect.id },
  })

  // Create primary contact
  await prisma.prospectContact.create({
    data: {
      prospectId: prospect.id,
      name: adminName,
      email: adminEmail,
      isPrimaryContact: true,
      discoveryDate: now,
    },
  })

  const activityNotes = duplicateFlag
    ? `${adminName} (${adminEmail}) registered "${orgName}". Multiple CRM prospects matched — flagged for manual review.`
    : rep
    ? `${adminName} (${adminEmail}) registered "${orgName}" via self-service. Assigned to ${rep.name}.`
    : `${adminName} (${adminEmail}) registered "${orgName}" via self-service. No eligible rep — placed in unassigned queue.`

  // Activity timeline entry
  await prisma.salesCrmActivity.create({
    data: {
      prospectId: prospect.id,
      activityType: "STATUS_CHANGED",
      subject: duplicateFlag ? "Customer Registered — Duplicate Flag" : "Customer Registered",
      notes: activityNotes,
      occurredAt: now,
    },
  })

  // Org-level activity
  await prisma.crmActivity.create({
    data: {
      organizationId: orgId,
      eventType: "customer_registered",
      description: duplicateFlag
        ? `Customer registered. Ambiguous company match — new record created and flagged for review.`
        : rep
        ? `Customer registered via ${crmSource}. New CRM prospect created and assigned to ${rep.name}.`
        : `Customer registered via ${crmSource}. New CRM prospect created. No eligible rep — unassigned.`,
      createdBySAName: "System",
    },
  })

  // Alert admins if ambiguous match or no rep
  if (duplicateFlag) {
    await notifyAmbiguousMatch(orgName, prospect.id).catch(console.error)
  } else if (!rep) {
    await notifyUnassignedInbound(orgName, prospect.id).catch(console.error)
  }
}

// ── Ensure a ProspectContact record exists for the registering user ────────────
async function ensureContact(params: { prospectId: string; adminEmail: string; adminName: string }): Promise<void> {
  const { prospectId, adminEmail, adminName } = params
  const existing = await prisma.prospectContact.findFirst({
    where: { prospectId, email: { equals: adminEmail, mode: "insensitive" } },
    select: { id: true },
  })
  if (!existing) {
    await prisma.prospectContact.create({
      data: {
        prospectId,
        name: adminName,
        email: adminEmail,
        isPrimaryContact: false,
        discoveryDate: new Date(),
      },
    })
  }
}

// ── Update onboarding status in CRM ──────────────────────────────────────────
export async function updateOnboardingStatusInCrm(
  orgId: string,
  status: OnboardingStatus,
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { crmProspectId: true, isDemo: true },
  })
  if (!org?.crmProspectId || org.isDemo) return

  const now = new Date()
  await prisma.prospect.update({
    where: { id: org.crmProspectId },
    data: {
      onboardingStatus: status,
      onboardingLastActivityAt: now,
    },
  })

  // Record meaningful milestones in the sales timeline
  if (status === "in_progress" || status === "completed") {
    const label = status === "completed" ? "Onboarding Completed" : "Onboarding Started"
    await prisma.salesCrmActivity.create({
      data: {
        prospectId: org.crmProspectId,
        activityType: "STATUS_CHANGED",
        subject: label,
        notes: `Customer onboarding status changed to: ${status}.`,
        occurredAt: now,
      },
    })

    // Also record on the org-level timeline
    await prisma.crmActivity.create({
      data: {
        organizationId: orgId,
        eventType: `onboarding_${status}`,
        description: label,
        createdBySAName: "System",
      },
    })
  }
}

// ── Resolve open onboarding stall tasks on completion ────────────────────────
export async function resolveOnboardingFollowUps(orgId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { crmProspectId: true },
  })
  if (!org?.crmProspectId) return

  await prisma.crmTask.updateMany({
    where: {
      prospectId: org.crmProspectId,
      taskType: "onboarding_followup",
      completedAt: null,
    },
    data: { completedAt: new Date(), notes: "Auto-resolved: onboarding completed." },
  })
}
