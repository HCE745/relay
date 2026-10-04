import bcrypt from "bcryptjs"
import { systemDb } from "../org-db"

// Purpose-built demo seed (NOT prisma/seed.ts / Summit). Builds a realistic,
// fully-populated Cleaning ERP for one throwaway demo org, dated relative to
// NOW so the dashboard, calendar and reports all look live. Parameterized by a
// residential/commercial mix. All writes set organizationId explicitly.

export type DemoMix = 0 | 1 | 2 | 3 // all-resi, mostly-resi, mostly-comm, all-comm
const COMMERCIAL_SHARE = [0, 0.25, 0.75, 1]

const DAY = 86_400_000
const PLACEHOLDER_KEY = "demo-placeholder" // served as a static SVG for demo orgs

function startOfWeek(now: Date): Date {
  const d = new Date(now)
  const dow = (d.getUTCDay() + 6) % 7 // Monday=0
  d.setUTCDate(d.getUTCDate() - dow)
  d.setUTCHours(0, 0, 0, 0)
  return d
}
const at = (base: Date, dayOffset: number, hour: number, min = 0) =>
  new Date(base.getTime() + dayOffset * DAY + (hour * 60 + min) * 60_000)

type Staff = { ownerId: string; managerId: string; supervisorIds: string[]; cleanerIds: string[] }

async function seedStaff(orgId: string, stamp: number): Promise<Staff & { owner: { id: string; email: string; name: string } }> {
  const pw = await bcrypt.hash("demo1234", 10)
  const mk = async (name: string, role: string, payRate?: string, code?: string) => {
    const u = await systemDb.user.create({
      data: {
        organizationId: orgId, name, email: `${name.toLowerCase().replace(/[^a-z]/g, ".")}-${stamp}@demo.local`,
        password: pw, role: role as "OWNER", isActive: true,
        ...(payRate ? { employeeProfile: { create: { organizationId: orgId, payType: "HOURLY", payRate, employeeCode: code, hireDate: new Date(Date.now() - 400 * DAY) } } } : {}),
      },
      select: { id: true, email: true, name: true },
    })
    return u
  }
  const owner = await mk("Dana Owner", "OWNER")
  const manager = await mk("Morgan Manager", "MANAGER")
  const sup1 = await mk("Sam Supervisor", "SUPERVISOR", "28.00", "SUP-01")
  const sup2 = await mk("Riley Supervisor", "SUPERVISOR", "27.00", "SUP-02")
  const cleanerNames = ["Alex Rivera", "Jordan Lee", "Casey Nguyen", "Taylor Brooks", "Jamie Patel", "Drew Kim", "Robin Ortiz"]
  const cleaners = []
  for (let i = 0; i < cleanerNames.length; i++) cleaners.push(await mk(cleanerNames[i], "CLEANER", (19 + i).toFixed(2), `EMP-${10 + i}`))
  return { owner, ownerId: owner.id, managerId: manager.id, supervisorIds: [sup1.id, sup2.id], cleanerIds: cleaners.map((c) => c.id) }
}

async function seedTemplates(orgId: string) {
  const commercial = await systemDb.checklistTemplate.create({
    data: {
      organizationId: orgId, name: "Commercial Nightly Scope", description: "Full nightly janitorial scope",
      items: {
        create: [
          { label: "Empty all waste & replace liners", sortOrder: 1, isRequired: true, requirePhoto: false },
          { label: "Restrooms: clean & restock", sortOrder: 2, isRequired: true, requirePhoto: true },
          { label: "Vacuum all carpeted areas", sortOrder: 3, isRequired: true, requirePhoto: false },
          { label: "Mop hard floors", sortOrder: 4, isRequired: true, requirePhoto: false },
          { label: "Disinfect high-touch surfaces", sortOrder: 5, isRequired: true, requirePhoto: true },
          { label: "Lock up & set alarm", sortOrder: 6, isRequired: true, requirePhoto: false },
        ],
      },
    },
    select: { id: true },
  })
  const residential = await systemDb.checklistTemplate.create({
    data: {
      organizationId: orgId, name: "Residential Clean", description: "Standard home clean",
      items: {
        create: [
          { label: "Kitchen: counters, sink, appliances", sortOrder: 1, isRequired: true, requirePhoto: false },
          { label: "Bathrooms: scrub & sanitize", sortOrder: 2, isRequired: true, requirePhoto: true },
          { label: "Dust & vacuum living areas", sortOrder: 3, isRequired: true, requirePhoto: false },
          { label: "Make beds & tidy bedrooms", sortOrder: 4, isRequired: false, requirePhoto: false },
        ],
      },
    },
    select: { id: true },
  })
  return { commercialTplId: commercial.id, residentialTplId: residential.id }
}

type Account = {
  name: string; kind: "commercial" | "residential"
  sites: { name: string; city: string; state: string }[]
  freq: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY"
  billingMode: "PER_JOB" | "FLAT_PERIOD"; rate: string; periodAmount?: string
  contractValue?: string
}

const COMMERCIAL: Account[] = [
  { name: "Northgate Office Tower", kind: "commercial", sites: [{ name: "Tower A Lobby & Floors 1–5", city: "Austin", state: "TX" }, { name: "Tower B Floors 1–4", city: "Austin", state: "TX" }], freq: "DAILY", billingMode: "FLAT_PERIOD", rate: "0", periodAmount: "6400.00", contractValue: "76800.00" },
  { name: "Cedar Valley Medical Clinic", kind: "commercial", sites: [{ name: "Main Clinic", city: "Round Rock", state: "TX" }], freq: "DAILY", billingMode: "FLAT_PERIOD", rate: "0", periodAmount: "3800.00", contractValue: "45600.00" },
  { name: "Lincoln Elementary School", kind: "commercial", sites: [{ name: "Main Building", city: "Pflugerville", state: "TX" }, { name: "Gymnasium & Annex", city: "Pflugerville", state: "TX" }], freq: "WEEKLY", billingMode: "PER_JOB", rate: "900.00" },
  { name: "Summit Light Industrial", kind: "commercial", sites: [{ name: "Warehouse & Offices", city: "Austin", state: "TX" }], freq: "WEEKLY", billingMode: "PER_JOB", rate: "1200.00", contractValue: "62400.00" },
]
const RESIDENTIAL: Account[] = [
  { name: "The Hendersons", kind: "residential", sites: [{ name: "Henderson Residence", city: "Cedar Park", state: "TX" }], freq: "BIWEEKLY", billingMode: "PER_JOB", rate: "180.00" },
  { name: "Maria Gomez", kind: "residential", sites: [{ name: "Gomez Home", city: "Leander", state: "TX" }], freq: "MONTHLY", billingMode: "PER_JOB", rate: "220.00" },
  { name: "The Patels", kind: "residential", sites: [{ name: "Patel Residence", city: "Austin", state: "TX" }], freq: "BIWEEKLY", billingMode: "PER_JOB", rate: "160.00" },
  { name: "James Carter", kind: "residential", sites: [{ name: "Carter Townhome", city: "Round Rock", state: "TX" }], freq: "MONTHLY", billingMode: "PER_JOB", rate: "140.00" },
]

// Which weekdays (0=Mon..6=Sun) a plan runs.
function runDays(freq: Account["freq"]): number[] {
  if (freq === "DAILY") return [0, 1, 2, 3, 4] // weeknights
  if (freq === "WEEKLY") return [1, 3] // ~3x/week when two sites; else Tue
  return [2] // biweekly/monthly: one visit this week (Wed)
}

export async function seedDemoOrg(orgId: string, mix: DemoMix): Promise<{ owner: { id: string; email: string; name: string } }> {
  const stamp = Date.now()
  const now = new Date()
  const week = startOfWeek(now)
  const todayOffset = Math.floor((now.getTime() - week.getTime()) / DAY)

  const staff = await seedStaff(orgId, stamp)
  const { commercialTplId, residentialTplId } = await seedTemplates(orgId)

  // Choose the account mix.
  const total = 6
  const commCount = Math.round(total * COMMERCIAL_SHARE[mix])
  const accounts = [...COMMERCIAL.slice(0, commCount), ...RESIDENTIAL.slice(0, total - commCount)]

  let invoiceNo = 1000
  let criticalFailUsed = false

  for (const acct of accounts) {
    const isComm = acct.kind === "commercial"
    const customer = await systemDb.customer.create({
      data: {
        organizationId: orgId, name: acct.name, isActive: true,
        primaryContactName: isComm ? "Facilities Manager" : acct.name,
        email: `ap-${stamp}@${acct.name.toLowerCase().replace(/[^a-z]/g, "")}.demo`,
        phone: "512-555-0" + (100 + invoiceNo % 800), billingEmail: null,
        paymentTerms: isComm ? "NET_30" : "DUE_ON_RECEIPT",
      },
      select: { id: true },
    })

    if (isComm && acct.contractValue) {
      await systemDb.contract.create({
        data: {
          organizationId: orgId, customerId: customer.id, title: `${acct.name} Service Agreement`,
          startDate: new Date(now.getTime() - 120 * DAY), endDate: new Date(now.getTime() + 245 * DAY),
          contractValue: acct.contractValue, billingFrequency: "MONTHLY", status: "ACTIVE",
        },
      })
    }

    for (const siteSpec of acct.sites) {
      const site = await systemDb.serviceLocation.create({
        data: { organizationId: orgId, customerId: customer.id, name: siteSpec.name, city: siteSpec.city, state: siteSpec.state, timezone: "America/Chicago", isActive: true },
        select: { id: true },
      })
      const plan = await systemDb.servicePlan.create({
        data: {
          organizationId: orgId, serviceLocationId: site.id, name: `${isComm ? "Janitorial" : "Home clean"} — ${acct.freq.toLowerCase()}`,
          frequency: acct.freq, startTime: isComm ? "19:00" : "10:00", crewSize: isComm ? 2 : 1,
          checklistTemplateId: isComm ? commercialTplId : residentialTplId,
          billingType: "FLAT_PER_JOB", rate: acct.billingMode === "PER_JOB" ? acct.rate : null, currency: "USD",
          billingMode: acct.billingMode, periodAmount: acct.periodAmount ?? null, periodFrequency: acct.billingMode === "FLAT_PERIOD" ? "MONTHLY" : null,
          isActive: true,
        },
        select: { id: true, checklistTemplateId: true },
      })

      // Span last-week-through-next-week (relative to today) on the plan's
      // weekdays, so the calendar always has BOTH completed and upcoming work
      // regardless of what day the visitor arrives.
      const runs = runDays(acct.freq)
      const dayOffsets: number[] = []
      for (let d = todayOffset - 6; d <= todayOffset + 7; d++) {
        const weekday = ((d % 7) + 7) % 7
        if (runs.includes(weekday)) dayOffsets.push(d)
      }
      for (const d of dayOffsets) {
        const past = d < todayOffset
        const isToday = d === todayOffset
        const start = at(week, d, isComm ? 19 : 10)
        const end = at(week, d, isComm ? 22 : 13)
        const status = past ? "COMPLETED" : isToday ? "IN_PROGRESS" : "ASSIGNED"
        const crew = isComm ? staff.cleanerIds.slice((((d % 3) + 3) % 3), (((d % 3) + 3) % 3) + 2) : [staff.cleanerIds[(((d % staff.cleanerIds.length) + staff.cleanerIds.length) % staff.cleanerIds.length)]]
        const job = await systemDb.job.create({
          data: {
            organizationId: orgId, serviceLocationId: site.id, servicePlanId: plan.id, title: `${acct.name} — ${siteSpec.name}`,
            status: status as "COMPLETED", scheduledStart: start, scheduledEnd: end,
            actualStart: past || isToday ? start : null, actualEnd: past ? end : null, crewSize: isComm ? 2 : 1,
            createdById: staff.managerId,
            assignments: { create: crew.map((uid) => ({ organizationId: orgId, userId: uid, status: past ? "COMPLETED" : "ASSIGNED" })) },
          },
          select: { id: true },
        })

        if (past) {
          // Approved time for each crew member.
          for (const uid of crew) {
            await systemDb.timeEntry.create({
              data: { organizationId: orgId, jobId: job.id, userId: uid, clockInAt: start, clockOutAt: end, breakMinutes: 15, status: "APPROVED", approvedById: staff.managerId, approvedAt: end, approvedPayType: "HOURLY", approvedPayRate: "22.00", clockInSource: "mobile_gps" },
            })
          }
          // A proof photo (placeholder — no real Blob write).
          await systemDb.jobPhoto.create({
            data: { organizationId: orgId, jobId: job.id, storageKey: PLACEHOLDER_KEY, contentType: "image/svg+xml", sizeBytes: 512, uploadedById: crew[0], caption: "Completed work" },
          })
          // One inspection on some completed commercial jobs; one is a critical failure.
          if (isComm && (d % 2 === 0)) {
            const critical: boolean = !criticalFailUsed
            if (critical) criticalFailUsed = true
            const score = critical ? 61 : 94
            await systemDb.inspection.create({
              data: {
                organizationId: orgId, serviceLocationId: site.id, jobId: job.id, inspectorId: staff.supervisorIds[d % 2],
                templateName: "Commercial QC", passThreshold: 80, status: "FINALIZED", score, outcome: critical ? "FAIL" : "PASS",
                finalizedAt: end, comments: critical ? "Restrooms not restocked; missed high-touch disinfection." : "Good work.",
                results: {
                  create: [
                    { label: "Restrooms restocked", points: 20, isCritical: true, requirePhoto: true, sortOrder: 1, result: critical ? "FAIL" : "PASS" },
                    { label: "High-touch disinfected", points: 20, isCritical: true, requirePhoto: false, sortOrder: 2, result: critical ? "FAIL" : "PASS" },
                    { label: "Floors clean", points: 20, isCritical: false, requirePhoto: false, sortOrder: 3, result: "PASS" },
                  ],
                },
              },
            })
          }
        }
      }
    }

    // Issues: one open, one resolved, per account.
    const firstSite = await systemDb.serviceLocation.findFirstOrThrow({ where: { organizationId: orgId, customerId: customer.id }, select: { id: true } })
    await systemDb.issue.create({ data: { organizationId: orgId, serviceLocationId: firstSite.id, reportedById: staff.supervisorIds[0], source: "STAFF", title: "Supply shortage", description: "Running low on paper towels at this site.", status: "OPEN" } })
    await systemDb.issue.create({ data: { organizationId: orgId, serviceLocationId: firstSite.id, reportedById: staff.managerId, source: "INSPECTION", title: "Entry mat replaced", description: "Worn entry mat flagged and replaced.", status: "RESOLVED", resolvedAt: new Date(now.getTime() - 2 * DAY) } })

    // Invoices (commercial): one SENT, one PARTIALLY_PAID.
    if (isComm) {
      const total1 = acct.periodAmount ?? acct.rate
      const sent = await systemDb.invoice.create({
        data: {
          organizationId: orgId, customerId: customer.id, invoiceNumber: invoiceNo++, status: "SENT",
          issueDate: new Date(now.getTime() - 20 * DAY), dueDate: new Date(now.getTime() + 10 * DAY),
          periodStart: new Date(now.getTime() - 50 * DAY), periodEnd: new Date(now.getTime() - 20 * DAY),
          subtotal: total1, total: total1,
          lines: { create: [{ description: `${acct.name} — monthly service`, serviceDate: new Date(now.getTime() - 25 * DAY), quantity: "1", unitRate: total1, amount: total1, billable: true }] },
        },
        select: { id: true },
      })
      void sent
      const total2 = acct.periodAmount ?? acct.rate
      const partial = await systemDb.invoice.create({
        data: {
          organizationId: orgId, customerId: customer.id, invoiceNumber: invoiceNo++, status: "PARTIALLY_PAID",
          issueDate: new Date(now.getTime() - 50 * DAY), dueDate: new Date(now.getTime() - 20 * DAY),
          periodStart: new Date(now.getTime() - 80 * DAY), periodEnd: new Date(now.getTime() - 50 * DAY),
          subtotal: total2, total: total2,
          lines: { create: [{ description: `${acct.name} — prior month`, serviceDate: new Date(now.getTime() - 55 * DAY), quantity: "1", unitRate: total2, amount: total2, billable: true }] },
        },
        select: { id: true, total: true },
      })
      const half = (Number(partial.total) / 2).toFixed(2)
      await systemDb.invoicePayment.create({ data: { invoiceId: partial.id, amount: half, method: "CHECK", receivedDate: new Date(now.getTime() - 30 * DAY) } })
    }
  }

  return { owner: staff.owner }
}
