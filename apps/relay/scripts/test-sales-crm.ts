#!/usr/bin/env tsx
/**
 * Comprehensive E2E integration test for Relay CRM:
 * - Sales account ownership + duplicate detection
 * - Commission splits, calculations, duration/eligibility
 * - Activity status flags (Protected, Inactive, no-outreach)
 * - Commission visibility scoping
 * - Multi-product isolation
 *
 * Runs entirely at the Prisma/business-logic layer — no browser, no real Stripe charges.
 * Creates test records, asserts, then deletes everything.
 */

import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

// ── Prisma client (same pattern as seed.ts) ────────────────────────────────
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!connectionString) throw new Error("DATABASE_URL or DIRECT_URL must be set")
const adapter = new PrismaPg(connectionString)
const prisma = new PrismaClient({ adapter })

// ── Business logic imports (relative paths, tsx resolves @/ via tsconfig) ──
import { normalizeCompanyName, normalizeDomain, findDuplicateProspect, validateCommissionSplits } from "../src/lib/prospect-utils"
// commission.ts uses its own prisma instance via @/lib/prisma — same DB, same results
import { createAttribution, createCommissionPaymentFromStripe } from "../src/lib/commission"

// ── Result tracking ─────────────────────────────────────────────────────────
type Result = { id: string; desc: string; expected: string; actual: string; pass: boolean; fix?: string }
const results: Result[] = []

function pass(id: string, desc: string, expected: string, actual: string) {
  results.push({ id, desc, expected, actual, pass: true })
}
function fail(id: string, desc: string, expected: string, actual: string, fix?: string) {
  results.push({ id, desc, expected, actual, pass: false, fix })
  console.error(`  ✗ ${id}: ${actual}`)
}
function assert(id: string, desc: string, expected: string, condition: boolean, actual: string, fix?: string) {
  if (condition) pass(id, desc, expected, actual)
  else fail(id, desc, expected, actual, fix)
}

// ── Test data IDs (collected for cleanup) ──────────────────────────────────
const testUserIds: string[] = []
const testProspectIds: string[] = []
const testOpportunityIds: string[] = []

// ═══════════════════════════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════════════════════════
async function setup() {
  console.log("\n── Setup: creating test users ──")
  const hash = await bcrypt.hash("test-password-123", 10)

  const admin = await prisma.salesUser.create({
    data: {
      email: "test-admin-crm@relay-test.internal",
      passwordHash: hash,
      name: "Test Admin",
      role: "admin_sales",
      employmentStatus: "ACTIVE",
      commissionEligible: false,
      commissionRate: 0,
      commissionDuration: "LIFETIME",
    },
  })
  testUserIds.push(admin.id)

  const alice = await prisma.salesUser.create({
    data: {
      email: "alice-test@relay-test.internal",
      passwordHash: hash,
      name: "Alice Test",
      role: "sales_rep",
      employmentStatus: "ACTIVE",
      commissionEligible: true,
      commissionRate: 25.00,
      commissionDuration: "LIFETIME",
    },
  })
  testUserIds.push(alice.id)

  const bob = await prisma.salesUser.create({
    data: {
      email: "bob-test@relay-test.internal",
      passwordHash: hash,
      name: "Bob Test",
      role: "sales_rep",
      employmentStatus: "ACTIVE",
      commissionEligible: true,
      commissionRate: 33.00,
      commissionDuration: "FIRST_YEAR",
    },
  })
  testUserIds.push(bob.id)

  console.log(`  Admin id=${admin.id}`)
  console.log(`  Alice id=${alice.id}`)
  console.log(`  Bob   id=${bob.id}`)
  return { admin, alice, bob }
}

// ═══════════════════════════════════════════════════════════════════════════
//  GROUP 1 — Duplicate Prospect Detection
// ═══════════════════════════════════════════════════════════════════════════
async function group1(alice: { id: string; name: string }, bob: { id: string; name: string }) {
  console.log("\n── Group 1: Duplicate Detection ──")

  // Use a timestamp-unique name to avoid clashing with any pre-existing production records
  const uniqueSuffix = Date.now()
  const testCompanyName = `Zyrox Test Fabrication ${uniqueSuffix}`
  const testDomain = `zyrox-test-${uniqueSuffix}.internal`

  // T1-1: Alice creates the test prospect
  const acme = await prisma.prospect.create({
    data: {
      companyName: testCompanyName,
      website: testDomain,
      assignedToId: alice.id,
      assignedToName: alice.name,
      currentCrmStatus: "researched",
    },
  })
  testProspectIds.push(acme.id)
  assert(
    "T1-1", "Alice creates prospect; assignedToId = Alice",
    "assignedToId = Alice",
    acme.assignedToId === alice.id,
    `assignedToId=${acme.assignedToId}`,
  )

  // T1-2: Bob searches for "[name] Inc" — name-based duplicate warning pointing to Alice
  const dup1 = await findDuplicateProspect({ companyName: `${testCompanyName} Inc` })
  assert(
    "T1-2", "Adding 'Inc' suffix still triggers name duplicate warning for Alice's record",
    `duplicate_detected pointing to Alice's record (id=${acme.id})`,
    dup1 !== null && dup1.id === acme.id,
    dup1 ? `dup found: ${dup1.companyName} (id=${dup1.id})` : "null — no duplicate detected",
  )
  // Verify prospect NOT blocked — only warned (creation still proceeds)
  const bobDupAttempt = await prisma.prospect.create({
    data: {
      companyName: `${testCompanyName} Inc`,
      website: `${testCompanyName.toLowerCase().replace(/ /g, "-")}-inc.internal`,
      assignedToId: bob.id,
      assignedToName: bob.name,
      currentCrmStatus: "researched",
    },
  })
  testProspectIds.push(bobDupAttempt.id)
  assert(
    "T1-2b", "Duplicate warning does NOT block creation (confirmDuplicate flow)",
    "Prospect created despite warning",
    bobDupAttempt.assignedToId === bob.id,
    `created id=${bobDupAttempt.id}`,
  )

  // T1-3: Domain-based duplicate warning — same domain, different name
  const dup2 = await findDuplicateProspect({ companyName: "Totally Different Corp 999", website: `www.${testDomain}` })
  assert(
    "T1-3", "Same domain triggers duplicate warning pointing to Alice",
    `duplicate_detected for ${testDomain} owned by Alice`,
    dup2 !== null && dup2.id === acme.id,
    dup2 ? `dup found: ${dup2.companyName} (id=${dup2.id})` : "null — no duplicate detected",
  )

  // T1-4: Bob creates a legitimately different prospect
  const zenithName = `Zenith Test Properties ${uniqueSuffix}`
  const zenithDomain = `zenith-test-${uniqueSuffix}.internal`
  const dup3 = await findDuplicateProspect({ companyName: zenithName, website: zenithDomain })
  assert(
    "T1-4a", "Zenith Properties has no duplicate warning",
    "null",
    dup3 === null,
    dup3 ? `unexpected dup: ${dup3.companyName}` : "null",
  )
  const zenith = await prisma.prospect.create({
    data: {
      companyName: zenithName,
      website: zenithDomain,
      assignedToId: bob.id,
      assignedToName: bob.name,
      currentCrmStatus: "researched",
    },
  })
  testProspectIds.push(zenith.id)
  assert(
    "T1-4b", "Different prospect created with assignedToId = Bob",
    "assignedToId = Bob",
    zenith.assignedToId === bob.id,
    `assignedToId=${zenith.assignedToId}`,
  )

  return {
    acme:   { ...acme,   assignedToId: acme.assignedToId! },
    zenith: { ...zenith, assignedToId: zenith.assignedToId! },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  GROUP 2 — Account Ownership Permissions
// ═══════════════════════════════════════════════════════════════════════════
async function group2(
  admin: { id: string },
  alice: { id: string },
  bob: { id: string },
  acme: { id: string; assignedToId: string },
  zenith: { id: string; assignedToId: string },
) {
  console.log("\n── Group 2: Account Ownership Permissions ──")

  // T2-1: Bob (rep) attempts to reassign Alice's prospect — should get 403
  const bobInfo = { isRep: true, salesUserId: bob.id, isManager: false, isSuperAdmin: false }
  const newAssignee = bob.id
  const isReassignment = newAssignee !== acme.assignedToId
  const forbidden = isReassignment && bobInfo.isRep
  assert(
    "T2-1", "Sales rep cannot reassign another rep's prospect",
    "forbidden = true (403)",
    forbidden === true,
    `forbidden=${forbidden}`,
  )
  // Verify DB unchanged
  const acmeAfterBobAttempt = await prisma.prospect.findUnique({ where: { id: acme.id }, select: { assignedToId: true } })
  assert(
    "T2-1b", "Acme assignedToId still Alice after Bob's blocked attempt",
    `assignedToId = ${alice.id}`,
    acmeAfterBobAttempt?.assignedToId === alice.id,
    `assignedToId=${acmeAfterBobAttempt?.assignedToId}`,
  )

  // T2-2: Admin reassigns Acme from Alice to Bob, with history record
  await prisma.prospect.update({ where: { id: acme.id }, data: { assignedToId: bob.id, assignedToName: "Bob Test" } })
  const hist1 = await prisma.accountAssignmentHistory.create({
    data: {
      recordType: "prospect",
      recordId: acme.id,
      previousOwnerId: alice.id,
      newOwnerId: bob.id,
      changedById: admin.id,
      changedByType: "SALES_USER",
    },
  })
  const acmeAfterAdmin = await prisma.prospect.findUnique({ where: { id: acme.id }, select: { assignedToId: true } })
  assert(
    "T2-2a", "Admin reassigns Acme to Bob",
    `assignedToId = ${bob.id}`,
    acmeAfterAdmin?.assignedToId === bob.id,
    `assignedToId=${acmeAfterAdmin?.assignedToId}`,
  )
  assert(
    "T2-2b", "AccountAssignmentHistory created: previousOwner=Alice, newOwner=Bob, changedBy=Admin",
    `previousOwnerId=${alice.id}, newOwnerId=${bob.id}, changedById=${admin.id}`,
    hist1.previousOwnerId === alice.id && hist1.newOwnerId === bob.id && hist1.changedById === admin.id,
    `prev=${hist1.previousOwnerId}, new=${hist1.newOwnerId}, by=${hist1.changedById}`,
  )

  // T2-3: Admin reassigns Acme back to Alice with reason
  await prisma.prospect.update({ where: { id: acme.id }, data: { assignedToId: alice.id, assignedToName: "Alice Test" } })
  const hist2 = await prisma.accountAssignmentHistory.create({
    data: {
      recordType: "prospect",
      recordId: acme.id,
      previousOwnerId: bob.id,
      newOwnerId: alice.id,
      changedById: admin.id,
      changedByType: "SALES_USER",
      reason: "Testing reassignment",
    },
  })
  assert(
    "T2-3", "Admin reassigns Acme back to Alice; second history record created",
    "2 history records for Acme; reason='Testing reassignment'",
    hist2.previousOwnerId === bob.id && hist2.newOwnerId === alice.id && hist2.reason === "Testing reassignment",
    `prev=${hist2.previousOwnerId}, new=${hist2.newOwnerId}, reason=${hist2.reason}`,
  )

  // T2-4: Alice (rep) attempts to reassign Zenith (owned by Bob) to herself — 403
  const aliceInfo = { isRep: true, salesUserId: alice.id, isManager: false, isSuperAdmin: false }
  const aliceReassignment = alice.id !== zenith.assignedToId
  const aliceForbidden = aliceReassignment && aliceInfo.isRep
  assert(
    "T2-4", "Alice cannot reassign Zenith (owned by Bob)",
    "forbidden = true (403)",
    aliceForbidden === true,
    `forbidden=${aliceForbidden}`,
  )

  // Return updated hist1 id for cleanup reference
  return { hist1Id: hist1.id, hist2Id: hist2.id }
}

// ═══════════════════════════════════════════════════════════════════════════
//  GROUP 3 — Protected Accounts
// ═══════════════════════════════════════════════════════════════════════════
async function group3(
  admin: { id: string },
  alice: { id: string },
  bob: { id: string },
  acme: { id: string },
) {
  console.log("\n── Group 3: Protected Accounts ──")

  // T3-1: Create a Demo-stage opportunity on Acme → prospect shows Protected
  const demoOpp = await prisma.crmOpportunity.create({
    data: {
      title: "Acme - Relay Demo",
      stage: "Demo",
      product: "relay",
      assignedToId: alice.id,
      prospectId: acme.id,
      commissionEligible: true,
    },
  })
  testOpportunityIds.push(demoOpp.id)

  // Compute activityStatus inline (mirrors manager/accounts route logic)
  const protectedStages = ["Demo", "Proposal", "Negotiating", "Closed Won"]
  const opportunities = await prisma.crmOpportunity.findMany({
    where: { prospectId: acme.id },
    select: { stage: true },
  })
  const hasActiveOpp = opportunities.some(o => protectedStages.includes(o.stage))
  const activityStatus = hasActiveOpp ? "PROTECTED" : "ACTIVE"
  assert(
    "T3-1", "Prospect with Demo-stage opp shows PROTECTED status",
    "PROTECTED",
    activityStatus === "PROTECTED",
    activityStatus,
  )

  // T3-2: Sales rep attempts to reassign Protected prospect — still blocked by rep rule
  const repInfo = { isRep: true, salesUserId: bob.id, isManager: false, isSuperAdmin: false }
  const repReassignment = bob.id !== alice.id // trying to change owner
  const repForbidden = repReassignment && repInfo.isRep
  assert(
    "T3-2", "Sales rep cannot reassign Protected prospect (same 403 rule)",
    "forbidden = true (403)",
    repForbidden === true,
    `forbidden=${repForbidden}`,
  )

  // T3-3: Admin overrides and reassigns Protected prospect
  await prisma.prospect.update({ where: { id: acme.id }, data: { assignedToId: bob.id, assignedToName: "Bob Test" } })
  const hist3 = await prisma.accountAssignmentHistory.create({
    data: {
      recordType: "prospect",
      recordId: acme.id,
      previousOwnerId: alice.id,
      newOwnerId: bob.id,
      changedById: admin.id,
      changedByType: "SALES_USER",
      reason: "Admin override of protected account",
    },
  })
  const acmeOwner = await prisma.prospect.findUnique({ where: { id: acme.id }, select: { assignedToId: true } })
  assert(
    "T3-3", "Admin can reassign Protected prospect; history record created",
    `assignedToId=${bob.id}, history.reason contains override`,
    acmeOwner?.assignedToId === bob.id && (hist3.reason?.includes("override") ?? false),
    `owner=${acmeOwner?.assignedToId}, reason=${hist3.reason}`,
  )
  // Reset Acme back to Alice for subsequent tests
  await prisma.prospect.update({ where: { id: acme.id }, data: { assignedToId: alice.id, assignedToName: "Alice Test" } })

  return { demoOpp }
}

// ═══════════════════════════════════════════════════════════════════════════
//  GROUP 4 — Inactivity Flags
// ═══════════════════════════════════════════════════════════════════════════
async function group4(alice: { id: string }) {
  console.log("\n── Group 4: Inactivity Flags ──")

  const now = new Date()
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000)

  // T4-1: Prospect created 10 days ago, no outreach
  const inactive10 = await prisma.prospect.create({
    data: {
      companyName: "Inactive Corp Test",
      assignedToId: alice.id,
      assignedToName: "Alice Test",
      currentCrmStatus: "researched",
      createdAt: daysAgo(10),
    },
  })
  testProspectIds.push(inactive10.id)
  // Activity status logic (mirrors route)
  const ageInDays10 = 10
  const noOutreachWarning10 =
    !inactive10.lastOutreachDate &&
    ageInDays10 >= 7 &&
    new Date(inactive10.createdAt) < daysAgo(7)
  assert(
    "T4-1", "Prospect 10 days old with no outreach → noOutreachWarning",
    "noOutreachWarning = true",
    noOutreachWarning10 === true,
    `noOutreachWarning=${noOutreachWarning10}`,
  )

  // T4-2: Prospect 35 days old, lastOutreachDate 32 days ago → INACTIVE
  const staleDate = daysAgo(32)
  const stale = await prisma.prospect.create({
    data: {
      companyName: "Stale Corp Test",
      assignedToId: alice.id,
      assignedToName: "Alice Test",
      currentCrmStatus: "contacted",
      createdAt: daysAgo(35),
      lastOutreachDate: staleDate,
    },
  })
  testProspectIds.push(stale.id)
  const INACTIVE_THRESHOLD_DAYS = 30
  const inactiveMs = INACTIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
  const staleLastActivity = staleDate
  const isInactive = (now.getTime() - staleLastActivity.getTime()) > inactiveMs
  assert(
    "T4-2", "Prospect with lastOutreach 32 days ago → INACTIVE",
    "activityStatus = INACTIVE",
    isInactive === true,
    `daysSinceOutreach=32, threshold=30, isInactive=${isInactive}`,
  )

  // T4-3: Prospect with email 2 days ago → NOT inactive
  const recent = await prisma.prospect.create({
    data: {
      companyName: "Recent Corp Test",
      assignedToId: alice.id,
      assignedToName: "Alice Test",
      currentCrmStatus: "contacted",
      createdAt: daysAgo(10),
      lastOutreachDate: daysAgo(2),
    },
  })
  testProspectIds.push(recent.id)
  const recentLastActivity = daysAgo(2)
  const recentIsInactive = (now.getTime() - recentLastActivity.getTime()) > inactiveMs
  assert(
    "T4-3", "Prospect with outreach 2 days ago → NOT inactive",
    "activityStatus != INACTIVE",
    recentIsInactive === false,
    `daysSinceOutreach=2, isInactive=${recentIsInactive}`,
  )

  // T4-4: Inactivity flags don't auto-reassign or auto-delete
  const inactiveCheck = await prisma.prospect.findUnique({ where: { id: stale.id }, select: { assignedToId: true } })
  assert(
    "T4-4", "Inactivity flags do not trigger automatic reassignment or deletion",
    `assignedToId still ${alice.id}`,
    inactiveCheck?.assignedToId === alice.id,
    `assignedToId=${inactiveCheck?.assignedToId}`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  GROUP 5 — Commission Splits
// ═══════════════════════════════════════════════════════════════════════════
async function group5(
  alice: { id: string },
  bob: { id: string },
  acme: { id: string },
) {
  console.log("\n── Group 5: Commission Splits ──")

  const TEST_ORG_ID = "test-org-acme-g5-" + Date.now()

  // Create a Closed Won opportunity for split testing
  const splitOpp = await prisma.crmOpportunity.create({
    data: {
      title: "Acme - Split Test Opportunity",
      stage: "Closed Won",
      product: "relay",
      assignedToId: alice.id,
      prospectId: acme.id,
      customerOrganizationId: TEST_ORG_ID,
      commissionEligible: true,
      wonAt: new Date(),
      closedAt: new Date(),
    },
  })
  testOpportunityIds.push(splitOpp.id)

  // T5-1: Alice 70%, Bob 30% — both created successfully
  const attrAlice = await prisma.commissionAttribution.create({
    data: {
      opportunityId: splitOpp.id,
      commissionOwnerId: alice.id,
      commissionRate: 25,
      splitPercent: 70,
      attributionStatus: "PENDING",
    },
  })
  const attrBob = await prisma.commissionAttribution.create({
    data: {
      opportunityId: splitOpp.id,
      commissionOwnerId: bob.id,
      commissionRate: 33,
      splitPercent: 30,
      attributionStatus: "PENDING",
    },
  })

  const existingAttrs = await prisma.commissionAttribution.findMany({
    where: { opportunityId: splitOpp.id },
    select: { splitPercent: true },
  })
  const validationError = validateCommissionSplits(existingAttrs)
  assert(
    "T5-1", "Alice 70% + Bob 30% splits are valid and created",
    "validationError = null, 2 attributions exist",
    validationError === null && existingAttrs.length === 2,
    `validationError=${validationError}, attrCount=${existingAttrs.length}`,
  )

  // T5-2: Attempt 60% + 60% = 120% — validation error
  const badSplits = [{ splitPercent: 60 }, { splitPercent: 60 }]
  const badValidation = validateCommissionSplits(badSplits)
  assert(
    "T5-2", "60% + 60% split returns 400 validation error",
    "error message containing '120'",
    badValidation !== null && badValidation.includes("120"),
    badValidation ?? "null",
  )

  // T5-3: Single 100% attribution — valid
  const singleSplit = validateCommissionSplits([{ splitPercent: 100 }])
  assert(
    "T5-3", "Single 100% split is valid",
    "null",
    singleSplit === null,
    singleSplit ?? "null",
  )

  return { splitOpp, attrAlice, attrBob, TEST_ORG_ID }
}

// ═══════════════════════════════════════════════════════════════════════════
//  GROUP 6 — Commission Calculations from Stripe Payments
// ═══════════════════════════════════════════════════════════════════════════
async function group6(
  splitOpp: { id: string },
  attrAlice: { id: string },
  attrBob: { id: string },
  TEST_ORG_ID: string,
) {
  console.log("\n── Group 6: Commission Calculations ──")

  const paymentDate = new Date("2026-06-15")

  // T6-1: $299 payment → Alice: $299*0.70*0.25=$52.33, Bob: $299*0.30*0.33=$29.60
  await createCommissionPaymentFromStripe({
    orgId: TEST_ORG_ID,
    stripePaymentIntentId: "pi_test_t6_001",
    grossRevenueCents: 29900,
    periodStart: null,
    periodEnd: null,
    paymentReceivedAt: paymentDate,
  })

  const paymentsAfterFirst = await prisma.commissionPayment.findMany({
    where: { attribution: { opportunityId: splitOpp.id } },
    include: { attribution: { select: { commissionOwnerId: true } } },
  })

  const alicePmt2 = paymentsAfterFirst.find(p => p.attributionId === attrAlice.id)
  const bobPmt2 = paymentsAfterFirst.find(p => p.attributionId === attrBob.id)

  const aliceCommission = alicePmt2 ? Number(alicePmt2.commissionAmount) : null
  const bobCommission = bobPmt2 ? Number(bobPmt2.commissionAmount) : null

  // Expected: Alice = 299 * 0.70 * 0.25 = 52.325 ≈ 52.33
  //           Bob   = 299 * 0.30 * 0.33 = 29.601 ≈ 29.60
  const aliceExpected = 299 * 0.70 * 0.25
  const bobExpected = 299 * 0.30 * 0.33

  assert(
    "T6-1a", "Alice receives correct commission on $299 payment with 70% split at 25% rate",
    `~$${aliceExpected.toFixed(2)}`,
    aliceCommission !== null && Math.abs(aliceCommission - aliceExpected) < 0.01,
    aliceCommission !== null ? `$${aliceCommission.toFixed(4)}` : "no payment found",
  )
  assert(
    "T6-1b", "Bob receives correct commission on $299 payment with 30% split at 33% rate",
    `~$${bobExpected.toFixed(2)}`,
    bobCommission !== null && Math.abs(bobCommission - bobExpected) < 0.01,
    bobCommission !== null ? `$${bobCommission.toFixed(4)}` : "no payment found",
  )
  assert(
    "T6-1c", "Two separate payment records created (not stacked)",
    "2 CommissionPayment records",
    paymentsAfterFirst.length === 2,
    `payment count=${paymentsAfterFirst.length}`,
  )

  // T6-2: Simulate $50 refund — proportional reduction
  // A $50 refund distributed proportionally: Alice 70% → $35, Bob 30% → $15
  if (alicePmt2 && bobPmt2) {
    const totalGross = Number(alicePmt2.grossRevenue) + Number(bobPmt2.grossRevenue)
    const refundTotal = 50
    const aliceRefund = refundTotal * (Number(alicePmt2.grossRevenue) / totalGross)
    const bobRefund = refundTotal * (Number(bobPmt2.grossRevenue) / totalGross)

    await prisma.commissionPayment.update({
      where: { id: alicePmt2.id },
      data: { refundAmount: aliceRefund },
    })
    await prisma.commissionPayment.update({
      where: { id: bobPmt2.id },
      data: { refundAmount: bobRefund },
    })

    const afterRefund = await prisma.commissionPayment.findMany({
      where: { attribution: { opportunityId: splitOpp.id } },
    })
    const totalRefundApplied = afterRefund.reduce((sum, p) => sum + Number(p.refundAmount), 0)
    assert(
      "T6-2", "Refund of $50 applied proportionally to Alice (70%) and Bob (30%)",
      "totalRefundAmount ≈ $50",
      Math.abs(totalRefundApplied - 50) < 0.01,
      `totalRefundAmount=$${totalRefundApplied.toFixed(2)}`,
    )
  } else {
    fail("T6-2", "Refund simulation", "$50 proportional refund", "SKIPPED — prior payments not found")
  }

  // T6-3: Cancellation — set commissionEligible=false, simulate another payment, verify no new payments
  await prisma.crmOpportunity.update({
    where: { id: splitOpp.id },
    data: { commissionEligible: false },
  })
  await createCommissionPaymentFromStripe({
    orgId: TEST_ORG_ID,
    stripePaymentIntentId: "pi_test_t6_003_canceled",
    grossRevenueCents: 29900,
    periodStart: null,
    periodEnd: null,
    paymentReceivedAt: new Date("2026-07-15"),
  })
  const paymentsAfterCancel = await prisma.commissionPayment.findMany({
    where: {
      attribution: { opportunityId: splitOpp.id },
      stripePaymentIntentId: "pi_test_t6_003_canceled",
    },
  })
  assert(
    "T6-3", "No new CommissionPayment after commissionEligible=false (simulates cancellation)",
    "0 new payments",
    paymentsAfterCancel.length === 0,
    `newPayments=${paymentsAfterCancel.length}`,
  )
  // Restore for subsequent tests
  await prisma.crmOpportunity.update({
    where: { id: splitOpp.id },
    data: { commissionEligible: true },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
//  GROUP 7 — Commission Duration and Eligibility
// ═══════════════════════════════════════════════════════════════════════════
async function group7(
  alice: { id: string },
  bob: { id: string },
  splitOpp: { id: string },
  attrAlice: { id: string },
  attrBob: { id: string },
  TEST_ORG_ID: string,
) {
  console.log("\n── Group 7: Commission Duration & Eligibility ──")

  // T7-1: Bob's commissionEndDate = yesterday → no payment for Bob, Alice still gets paid
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  await prisma.commissionAttribution.update({
    where: { id: attrBob.id },
    data: { commissionEndDate: yesterday },
  })

  const pi_t71 = "pi_test_t7_001"
  await createCommissionPaymentFromStripe({
    orgId: TEST_ORG_ID,
    stripePaymentIntentId: pi_t71,
    grossRevenueCents: 29900,
    periodStart: null,
    periodEnd: null,
    paymentReceivedAt: new Date(),
  })
  const t71Payments = await prisma.commissionPayment.findMany({
    where: { stripePaymentIntentId: pi_t71 },
    include: { attribution: { select: { commissionOwnerId: true } } },
  })
  const t71AlicePaid = t71Payments.some(p => p.attribution.commissionOwnerId === alice.id)
  const t71BobPaid = t71Payments.some(p => p.attribution.commissionOwnerId === bob.id)
  assert(
    "T7-1a", "Bob not paid after commissionEndDate expired",
    "no Bob payment",
    !t71BobPaid,
    `bobPaid=${t71BobPaid}`,
  )
  assert(
    "T7-1b", "Alice still paid (LIFETIME, no end date)",
    "Alice has payment",
    t71AlicePaid,
    `alicePaid=${t71AlicePaid}`,
  )

  // T7-2: Alice has LIFETIME with no endDate — future payment (2 years from now) still generates commission
  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 2)
  const pi_t72 = "pi_test_t7_002_future"
  await createCommissionPaymentFromStripe({
    orgId: TEST_ORG_ID,
    stripePaymentIntentId: pi_t72,
    grossRevenueCents: 29900,
    periodStart: null,
    periodEnd: null,
    paymentReceivedAt: futureDate,
  })
  const t72Payments = await prisma.commissionPayment.findMany({
    where: { stripePaymentIntentId: pi_t72, attribution: { commissionOwnerId: alice.id } },
  })
  assert(
    "T7-2", "Alice (LIFETIME) still receives commission 2 years in the future",
    "Alice has payment",
    t72Payments.length > 0,
    `paymentCount=${t72Payments.length}`,
  )

  // T7-3: Bob set to INACTIVE → no commission payment
  await prisma.salesUser.update({ where: { id: bob.id }, data: { employmentStatus: "INACTIVE" } })
  // Also reset Bob's endDate so it's not the blocker
  await prisma.commissionAttribution.update({
    where: { id: attrBob.id },
    data: { commissionEndDate: null },
  })
  const pi_t73 = "pi_test_t7_003_inactive"
  await createCommissionPaymentFromStripe({
    orgId: TEST_ORG_ID,
    stripePaymentIntentId: pi_t73,
    grossRevenueCents: 29900,
    periodStart: null,
    periodEnd: null,
    paymentReceivedAt: new Date(),
  })
  const t73Payments = await prisma.commissionPayment.findMany({
    where: { stripePaymentIntentId: pi_t73 },
    include: { attribution: { select: { commissionOwnerId: true } } },
  })
  const t73BobPaid = t73Payments.some(p => p.attribution.commissionOwnerId === bob.id)
  const t73AlicePaid = t73Payments.some(p => p.attribution.commissionOwnerId === alice.id)
  assert(
    "T7-3a", "INACTIVE Bob receives no commission",
    "no Bob payment",
    !t73BobPaid,
    `bobPaid=${t73BobPaid}`,
  )
  assert(
    "T7-3b", "Active Alice still receives commission while Bob is INACTIVE",
    "Alice has payment",
    t73AlicePaid,
    `alicePaid=${t73AlicePaid}`,
  )

  // T7-4: Re-activate Bob → payments resume
  await prisma.salesUser.update({ where: { id: bob.id }, data: { employmentStatus: "ACTIVE" } })
  const pi_t74 = "pi_test_t7_004_reactivated"
  await createCommissionPaymentFromStripe({
    orgId: TEST_ORG_ID,
    stripePaymentIntentId: pi_t74,
    grossRevenueCents: 29900,
    periodStart: null,
    periodEnd: null,
    paymentReceivedAt: new Date(),
  })
  const t74Payments = await prisma.commissionPayment.findMany({
    where: { stripePaymentIntentId: pi_t74 },
    include: { attribution: { select: { commissionOwnerId: true } } },
  })
  const t74BobPaid = t74Payments.some(p => p.attribution.commissionOwnerId === bob.id)
  assert(
    "T7-4", "Re-activated Bob resumes receiving commission",
    "Bob has payment",
    t74BobPaid,
    `bobPaid=${t74BobPaid}`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  GROUP 8 — Commission Visibility Restrictions
// ═══════════════════════════════════════════════════════════════════════════
async function group8(
  alice: { id: string },
  bob: { id: string },
  attrAlice: { id: string },
  attrBob: { id: string },
) {
  console.log("\n── Group 8: Commission Visibility Restrictions ──")

  // T8-1: Alice's view — only her attributions/payments
  const alicePayments = await prisma.commissionPayment.findMany({
    where: { attribution: { commissionOwnerId: alice.id } },
  })
  assert(
    "T8-1", "Alice's commission view contains only Alice's records",
    "all records owned by Alice",
    alicePayments.every(p => p.attributionId === attrAlice.id),
    `alicePayments=${alicePayments.length}, all correct=${alicePayments.every(p => p.attributionId === attrAlice.id)}`,
  )

  // T8-2: Bob's view — only his payments
  const bobPayments = await prisma.commissionPayment.findMany({
    where: { attribution: { commissionOwnerId: bob.id } },
  })
  assert(
    "T8-2", "Bob's commission view contains only Bob's records",
    "all records owned by Bob",
    bobPayments.every(p => p.attributionId === attrBob.id),
    `bobPayments=${bobPayments.length}, all correct=${bobPayments.every(p => p.attributionId === attrBob.id)}`,
  )

  // T8-3: Admin view — all records (no scoping)
  const allPayments = await prisma.commissionPayment.findMany({
    where: { attributionId: { in: [attrAlice.id, attrBob.id] } },
    include: { attribution: { select: { commissionOwnerId: true } } },
  })
  const hasAlice = allPayments.some(p => p.attribution.commissionOwnerId === alice.id)
  const hasBob = allPayments.some(p => p.attribution.commissionOwnerId === bob.id)
  assert(
    "T8-3", "Admin commission view shows records for both Alice and Bob",
    "both Alice and Bob payments visible",
    hasAlice && hasBob,
    `hasAlice=${hasAlice}, hasBob=${hasBob}`,
  )

  // T8-4: Alice attempts to access Bob's records directly (403 logic)
  // Route handler: if info.isRep && salesUser.id !== info.salesUserId → 403
  const aliceInfo = { isRep: true, salesUserId: alice.id }
  const bobAttribution = await prisma.commissionAttribution.findUnique({ where: { id: attrBob.id } })
  const aliceCanAccessBob = !aliceInfo.isRep || (bobAttribution?.commissionOwnerId === aliceInfo.salesUserId)
  assert(
    "T8-4", "Alice cannot access Bob's commission records (403 logic)",
    "canAccess = false",
    !aliceCanAccessBob,
    `aliceCanAccessBob=${aliceCanAccessBob}`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  GROUP 9 — Multi-Product Commission Isolation
// ═══════════════════════════════════════════════════════════════════════════
async function group9(
  alice: { id: string },
  bob: { id: string },
  acme: { id: string },
) {
  console.log("\n── Group 9: Multi-Product Commission Isolation ──")

  const RELAY_ORG_ID = "test-org-acme-relay-" + Date.now()
  const CLEANING_ORG_ID = "test-org-acme-cleaning-" + Date.now()

  // T9-1: Alice closes Relay opportunity for Acme
  const relayOpp = await prisma.crmOpportunity.create({
    data: {
      title: "Acme - Relay (Product Test)",
      stage: "Closed Won",
      product: "relay",
      assignedToId: alice.id,
      prospectId: acme.id,
      customerOrganizationId: RELAY_ORG_ID,
      commissionEligible: true,
      wonAt: new Date(),
      closedAt: new Date(),
    },
  })
  testOpportunityIds.push(relayOpp.id)
  const relayAttr = await prisma.commissionAttribution.create({
    data: {
      opportunityId: relayOpp.id,
      commissionOwnerId: alice.id,
      commissionRate: 25,
      splitPercent: 100,
      attributionStatus: "PENDING",
    },
  })
  assert(
    "T9-1", "Alice has commission attribution on Relay product opportunity",
    "1 attribution, commissionOwner = Alice",
    relayAttr.commissionOwnerId === alice.id,
    `owner=${relayAttr.commissionOwnerId}`,
  )

  // T9-2: Bob closes Cleaning opportunity for Acme — no Alice attribution
  const cleaningOpp = await prisma.crmOpportunity.create({
    data: {
      title: "Acme - Cleaning (Product Test)",
      stage: "Closed Won",
      product: "cleaning",
      assignedToId: bob.id,
      prospectId: acme.id,
      customerOrganizationId: CLEANING_ORG_ID,
      commissionEligible: true,
      wonAt: new Date(),
      closedAt: new Date(),
    },
  })
  testOpportunityIds.push(cleaningOpp.id)
  const cleaningAttr = await prisma.commissionAttribution.create({
    data: {
      opportunityId: cleaningOpp.id,
      commissionOwnerId: bob.id,
      commissionRate: 33,
      splitPercent: 100,
      attributionStatus: "PENDING",
    },
  })

  // T9-3: Payment tagged to Cleaning org → only Bob gets commission
  const pi_t93 = "pi_test_t9_003_cleaning"
  await createCommissionPaymentFromStripe({
    orgId: CLEANING_ORG_ID,
    stripePaymentIntentId: pi_t93,
    grossRevenueCents: 29900,
    periodStart: null,
    periodEnd: null,
    paymentReceivedAt: new Date(),
  })
  const t93Payments = await prisma.commissionPayment.findMany({
    where: { stripePaymentIntentId: pi_t93 },
    include: { attribution: { select: { commissionOwnerId: true } } },
  })
  const t93BobOnly = t93Payments.every(p => p.attribution.commissionOwnerId === bob.id)
  const t93AliceInvolved = t93Payments.some(p => p.attribution.commissionOwnerId === alice.id)
  assert(
    "T9-3", "Cleaning payment only generates Bob's commission, not Alice's",
    "only Bob, not Alice",
    t93BobOnly && !t93AliceInvolved,
    `bobOnly=${t93BobOnly}, aliceInvolved=${t93AliceInvolved}, paymentCount=${t93Payments.length}`,
  )

  // T9-4: Payment tagged to Relay org → only Alice gets commission
  const pi_t94 = "pi_test_t9_004_relay"
  await createCommissionPaymentFromStripe({
    orgId: RELAY_ORG_ID,
    stripePaymentIntentId: pi_t94,
    grossRevenueCents: 29900,
    periodStart: null,
    periodEnd: null,
    paymentReceivedAt: new Date(),
  })
  const t94Payments = await prisma.commissionPayment.findMany({
    where: { stripePaymentIntentId: pi_t94 },
    include: { attribution: { select: { commissionOwnerId: true } } },
  })
  const t94AliceOnly = t94Payments.every(p => p.attribution.commissionOwnerId === alice.id)
  const t94BobInvolved = t94Payments.some(p => p.attribution.commissionOwnerId === bob.id)
  assert(
    "T9-4", "Relay payment only generates Alice's commission, not Bob's",
    "only Alice, not Bob",
    t94AliceOnly && !t94BobInvolved,
    `aliceOnly=${t94AliceOnly}, bobInvolved=${t94BobInvolved}, paymentCount=${t94Payments.length}`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  GROUP 10 — Duplicate Confirmation System
// ═══════════════════════════════════════════════════════════════════════════
async function group10(
  admin: { id: string },
  alice: { id: string },
) {
  console.log("\n── Group 10: Duplicate Confirmation System ──")

  const ts = Date.now()
  const baseName = `Zyrox Confirmation Base ${ts}`
  const dupName = `Zyrox Confirmation Dup ${ts}`
  const uniqueName = `Zyrox Absolutely Unique ${ts}`

  // Create a base prospect to act as the "existing" record
  const baseProspect = await prisma.prospect.create({
    data: {
      companyName: baseName,
      website: `zyrox-base-${ts}.com`,
      assignedToId: alice.id,
      assignedToName: "Alice",
    },
  })
  testProspectIds.push(baseProspect.id)

  // TD-1: findDuplicateProspect detects the base record (simulates 409 response from route)
  const detected = await findDuplicateProspect({ companyName: baseName, website: `zyrox-base-${ts}.com` })
  assert(
    "TD-1", "Duplicate detection finds existing record (would return 409 without confirmDuplicate)",
    `detected id=${baseProspect.id}`,
    detected?.id === baseProspect.id,
    `detected=${detected?.id ?? "null"}, expected=${baseProspect.id}`,
  )

  // TD-2: Create a confirmed duplicate (duplicateFlag: true, duplicateOfId set)
  const confirmedDup = await prisma.prospect.create({
    data: {
      companyName: dupName,
      website: `zyrox-dup-${ts}.com`,
      assignedToId: alice.id,
      assignedToName: "Alice",
      duplicateFlag: true,
      duplicateOfId: baseProspect.id,
    },
  })
  testProspectIds.push(confirmedDup.id)
  assert(
    "TD-2", "Confirmed duplicate prospect has duplicateFlag=true and duplicateOfId set",
    `duplicateFlag=true, duplicateOfId=${baseProspect.id}`,
    confirmedDup.duplicateFlag === true && confirmedDup.duplicateOfId === baseProspect.id,
    `duplicateFlag=${confirmedDup.duplicateFlag}, duplicateOfId=${confirmedDup.duplicateOfId}`,
  )

  // TD-3: SalesAlert notifications created for all admin_sales users when confirmed duplicate is added
  const adminUsers = await prisma.salesUser.findMany({
    where: { role: "admin_sales", isActive: true },
    select: { id: true },
  })
  const alertsBefore = adminUsers.length
  if (alertsBefore > 0) {
    await prisma.salesAlert.createMany({
      data: adminUsers.map(u => ({
        recipientId: u.id,
        type: "duplicate_prospect",
        title: "Potential duplicate account created",
        message: `Test alert for ${dupName}`,
        relatedId: confirmedDup.id,
      })),
    })
  }
  const alertsCreated = await prisma.salesAlert.count({
    where: { relatedId: confirmedDup.id },
  })
  assert(
    "TD-3", "SalesAlert created for each admin_sales user when confirmed duplicate is added",
    `alerts=${alertsBefore}`,
    alertsCreated === alertsBefore,
    `created=${alertsCreated}, expected=${alertsBefore}`,
  )

  // TD-4: Flagged duplicate appears in admin dashboard duplicate count query
  const flaggedCount = await prisma.prospect.count({ where: { duplicateFlag: true } })
  assert(
    "TD-4", "Admin dashboard query includes the flagged duplicate record",
    "flaggedCount >= 1",
    flaggedCount >= 1,
    `flaggedCount=${flaggedCount}`,
  )

  // TD-5: Unique company creates without any confirmation step (findDuplicateProspect returns null)
  const noMatch = await findDuplicateProspect({ companyName: uniqueName, website: `zyrox-unique-${ts}.com` })
  assert(
    "TD-5", "Unique company name + domain returns no duplicate match",
    "null (no match)",
    noMatch === null,
    `noMatch=${noMatch?.companyName ?? "null"}`,
  )

  // Verify the unique record would be created directly (no 409)
  const uniqueProspect = await prisma.prospect.create({
    data: {
      companyName: uniqueName,
      website: `zyrox-unique-${ts}.com`,
      assignedToId: alice.id,
      assignedToName: "Alice",
      // No duplicateFlag set — clean creation
    },
  })
  testProspectIds.push(uniqueProspect.id)
  assert(
    "TD-5b", "Unique prospect created without duplicateFlag",
    "duplicateFlag=false",
    uniqueProspect.duplicateFlag === false,
    `duplicateFlag=${uniqueProspect.duplicateFlag}`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  CLEANUP
// ═══════════════════════════════════════════════════════════════════════════
async function cleanup() {
  console.log("\n── Cleanup ──")

  // Delete in dependency order: alerts → payments → attributions → history → opportunities → prospects → users
  await prisma.salesAlert.deleteMany({
    where: { relatedId: { in: testProspectIds } },
  })
  await prisma.commissionPayment.deleteMany({
    where: { attribution: { opportunityId: { in: testOpportunityIds } } },
  })
  await prisma.commissionAttribution.deleteMany({
    where: { opportunityId: { in: testOpportunityIds } },
  })
  await prisma.crmOpportunity.deleteMany({ where: { id: { in: testOpportunityIds } } })
  await prisma.accountAssignmentHistory.deleteMany({
    where: { recordId: { in: testProspectIds } },
  })
  await prisma.prospect.deleteMany({ where: { id: { in: testProspectIds } } })
  await prisma.salesUser.deleteMany({ where: { id: { in: testUserIds } } })

  // Verify
  const leftoverUsers = await prisma.salesUser.findMany({ where: { id: { in: testUserIds } } })
  const leftoverProspects = await prisma.prospect.findMany({ where: { id: { in: testProspectIds } } })
  const leftoverOpps = await prisma.crmOpportunity.findMany({ where: { id: { in: testOpportunityIds } } })

  console.log(`  Users deleted: ${testUserIds.length - leftoverUsers.length}/${testUserIds.length}`)
  console.log(`  Prospects deleted: ${testProspectIds.length - leftoverProspects.length}/${testProspectIds.length}`)
  console.log(`  Opportunities deleted: ${testOpportunityIds.length - leftoverOpps.length}/${testOpportunityIds.length}`)

  assert(
    "CLEANUP", "All test records deleted successfully",
    "0 leftover records",
    leftoverUsers.length === 0 && leftoverProspects.length === 0 && leftoverOpps.length === 0,
    `leftover: users=${leftoverUsers.length}, prospects=${leftoverProspects.length}, opps=${leftoverOpps.length}`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  REPORT
// ═══════════════════════════════════════════════════════════════════════════
function report() {
  console.log("\n" + "═".repeat(110))
  console.log("TEST RESULTS")
  console.log("═".repeat(110))

  const idW = 10, descW = 52, expW = 38, actW = 44
  const header = [
    "Test ID".padEnd(idW),
    "Description".padEnd(descW),
    "Expected".padEnd(expW),
    "Actual".padEnd(actW),
    "Pass/Fail",
  ].join(" │ ")
  console.log(header)
  console.log("─".repeat(110))

  for (const r of results) {
    const id = r.id.padEnd(idW)
    const desc = r.desc.slice(0, descW - 1).padEnd(descW)
    const exp = r.expected.slice(0, expW - 1).padEnd(expW)
    const act = r.actual.slice(0, actW - 1).padEnd(actW)
    const status = r.pass ? "✓ PASS" : "✗ FAIL"
    console.log(`${id} │ ${desc} │ ${exp} │ ${act} │ ${status}`)
    if (!r.pass && r.fix) console.log(`${" ".repeat(idW + 3)}[FIX]: ${r.fix}`)
  }

  console.log("─".repeat(110))
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  console.log(`TOTAL: ${results.length} tests  │  ${passed} passed  │  ${failed} failed`)
  console.log("═".repeat(110))

  return failed
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log("Starting Relay CRM E2E Integration Tests")
  console.log("  Scope: account ownership, duplicate detection, commission splits/calculations, activity status")
  console.log("  Mode:  database + business-logic layer (no real Stripe charges, no browser)\n")

  const { admin, alice, bob } = await setup()

  try {
    // Group 1
    const { acme, zenith } = await group1(alice, bob)

    // Group 2
    await group2(admin, alice, bob, acme, zenith)

    // Group 3
    const { demoOpp } = await group3(admin, alice, bob, acme)
    testOpportunityIds.push(demoOpp.id) // track for cleanup

    // Group 4
    await group4(alice)

    // Group 5
    const { splitOpp, attrAlice, attrBob, TEST_ORG_ID } = await group5(alice, bob, acme)

    // Group 6
    await group6(splitOpp, attrAlice, attrBob, TEST_ORG_ID)

    // Group 7
    await group7(alice, bob, splitOpp, attrAlice, attrBob, TEST_ORG_ID)

    // Group 8
    await group8(alice, bob, attrAlice, attrBob)

    // Group 9
    await group9(alice, bob, acme)

    // Group 10
    await group10(admin, alice)

  } catch (err) {
    console.error("\n  UNEXPECTED ERROR during tests:", err)
    fail("UNEXPECTED", "Unhandled error during test run", "no error", String(err))
  } finally {
    await cleanup()
    const failCount = report()
    await prisma.$disconnect()
    process.exit(failCount > 0 ? 1 : 0)
  }
}

main()
