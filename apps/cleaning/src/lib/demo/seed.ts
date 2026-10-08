import bcrypt from "bcryptjs"
import { systemDb } from "../org-db"

// Purpose-built demo seed (NOT prisma/seed.ts / Summit). Builds a realistic,
// fully-populated Cleaning ERP for one throwaway demo org, dated relative to
// NOW so the dashboard, calendar and reports all look live. Parameterized by a
// residential/commercial mix. All writes set organizationId explicitly.

export type DemoMix = 0 | 1 | 2 | 3 | 4 // all-resi, mostly-resi, even, mostly-comm, all-comm
const COMMERCIAL_SHARE = [0, 0.25, 0.5, 0.75, 1]

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
  { name: "Riverside Dental Group", kind: "commercial", sites: [{ name: "Riverside Office", city: "Austin", state: "TX" }], freq: "DAILY", billingMode: "FLAT_PERIOD", rate: "0", periodAmount: "2900.00", contractValue: "34800.00" },
  { name: "Metro Fitness Center", kind: "commercial", sites: [{ name: "Downtown Club", city: "Austin", state: "TX" }, { name: "North Club", city: "Round Rock", state: "TX" }], freq: "DAILY", billingMode: "FLAT_PERIOD", rate: "0", periodAmount: "5200.00", contractValue: "62400.00" },
]
const RESIDENTIAL: Account[] = [
  { name: "The Hendersons", kind: "residential", sites: [{ name: "Henderson Residence", city: "Cedar Park", state: "TX" }], freq: "BIWEEKLY", billingMode: "PER_JOB", rate: "180.00" },
  { name: "Maria Gomez", kind: "residential", sites: [{ name: "Gomez Home", city: "Leander", state: "TX" }], freq: "MONTHLY", billingMode: "PER_JOB", rate: "220.00" },
  { name: "The Patels", kind: "residential", sites: [{ name: "Patel Residence", city: "Austin", state: "TX" }], freq: "BIWEEKLY", billingMode: "PER_JOB", rate: "160.00" },
  { name: "James Carter", kind: "residential", sites: [{ name: "Carter Townhome", city: "Round Rock", state: "TX" }], freq: "MONTHLY", billingMode: "PER_JOB", rate: "140.00" },
  { name: "The Wongs", kind: "residential", sites: [{ name: "Wong Residence", city: "Cedar Park", state: "TX" }], freq: "BIWEEKLY", billingMode: "PER_JOB", rate: "175.00" },
  { name: "Sofia Alvarez", kind: "residential", sites: [{ name: "Alvarez Home", city: "Austin", state: "TX" }], freq: "MONTHLY", billingMode: "PER_JOB", rate: "200.00" },
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
  // Collected for the extras pass that fills every remaining screen.
  const ctx: {
    customers: { id: string; name: string; isComm: boolean }[]
    sites: { id: string; customerId: string; isComm: boolean }[]
    completedJobIds: string[]
    commercialTplId: string
  } = { customers: [], sites: [], completedJobIds: [], commercialTplId }

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
    ctx.customers.push({ id: customer.id, name: acct.name, isComm })

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
      ctx.sites.push({ id: site.id, customerId: customer.id, isComm })
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
          ctx.completedJobIds.push(job.id)
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

  await seedExtras(orgId, stamp, now, week, todayOffset, staff, ctx, () => invoiceNo++)
  return { owner: staff.owner }
}

// Everything needed so NO admin screen renders empty: CRM, assets/supplies +
// usage, compliance, access, coverage/availability, exports, a portal invite,
// extra invoice statuses, and a few dashboard-tile triggers. Uses existing
// models only — no migration.
async function seedExtras(
  orgId: string, stamp: number, now: Date, week: Date, todayOffset: number,
  staff: Staff & { owner: { id: string; email: string; name: string } },
  ctx: { customers: { id: string; name: string; isComm: boolean }[]; sites: { id: string; customerId: string; isComm: boolean }[]; completedJobIds: string[]; commercialTplId: string },
  nextInvoiceNo: () => number,
) {
  const days = (n: number) => new Date(now.getTime() + n * DAY)
  const commCustomer = ctx.customers.find((c) => c.isComm) ?? ctx.customers[0]
  const commSite = ctx.sites.find((s) => s.isComm) ?? ctx.sites[0]
  const cleaner = staff.cleanerIds[0]
  const cleaner2 = staff.cleanerIds[1]

  // ── Supplies (one below reorder) + usage against completed jobs ──
  const supplyDefs = [
    { name: "All-purpose cleaner (gal)", unit: "gal", currentStock: "38", reorderThreshold: "10", costPerUnit: "12.50" },
    { name: "Paper towels (case)", unit: "case", currentStock: "6", reorderThreshold: "24", costPerUnit: "28.00" }, // BELOW reorder
    { name: "Trash liners (case)", unit: "case", currentStock: "140", reorderThreshold: "50", costPerUnit: "19.00" },
    { name: "Disinfectant wipes (case)", unit: "case", currentStock: "15", reorderThreshold: "20", costPerUnit: "22.75" }, // BELOW reorder
  ]
  const supplies = []
  for (const s of supplyDefs) supplies.push(await systemDb.supply.create({ data: { organizationId: orgId, ...s }, select: { id: true, costPerUnit: true } }))
  // Record usage on completed jobs so supply cost flows into profitability + spend.
  const usageJobs = ctx.completedJobIds.slice(0, 8)
  for (let i = 0; i < usageJobs.length; i++) {
    const supply = supplies[i % supplies.length]
    const job = await systemDb.job.findUniqueOrThrow({ where: { id: usageJobs[i] }, select: { serviceLocationId: true } })
    await systemDb.supplyUsage.create({
      data: { organizationId: orgId, supplyId: supply.id, quantity: String(1 + (i % 3)), costPerUnit: supply.costPerUnit, jobId: usageJobs[i], serviceLocationId: job.serviceLocationId, recordedById: cleaner },
    })
  }

  // ── Leads (various statuses) ──
  const leadDefs: { name: string; company: string; status: "NEW" | "CONTACTED" | "ESTIMATING" | "WON" | "LOST"; source: string }[] = [
    { name: "Pat Nguyen", company: "Brightwork Coworking", status: "NEW", source: "website" },
    { name: "Dana Fields", company: "Hillside Church", status: "CONTACTED", source: "referral" },
    { name: "Omar Haddad", company: "TechNova HQ", status: "ESTIMATING", source: "cold call" },
    { name: "Lena Park", company: "Park Dental", status: "WON", source: "referral" },
    { name: "Chris Bell", company: "Bell Autobody", status: "LOST", source: "website" },
  ]
  for (const l of leadDefs) {
    await systemDb.lead.create({ data: { organizationId: orgId, name: l.name, company: l.company, email: `${l.name.toLowerCase().replace(/[^a-z]/g, "")}-${stamp}@lead.demo`, phone: "512-555-0199", source: l.source, status: l.status, assignedToId: staff.managerId } })
  }

  // ── Estimates: DRAFT, SENT (with bid worksheet), ACCEPTED + converted ──
  await systemDb.estimate.create({
    data: {
      organizationId: orgId, title: "Brightwork Coworking — nightly", status: "DRAFT", pricing: "PER_VISIT", rate: "650.00", total: "650.00", subtotal: "650.00",
      contactName: "Pat Nguyen", siteName: "Brightwork Downtown", city: "Austin", state: "TX",
      lines: { create: [{ description: "Nightly janitorial", quantity: "1", unitRate: "650.00", amount: "650.00", sortOrder: 0 }] },
    },
  })
  const bidInputs = {
    areas: [{ name: "Open office", sqft: 12000, surfaceType: "Carpet (open area)", sqftPerHour: 7000, frequency: "WEEKLY" }, { name: "Restrooms", sqft: 1200, surfaceType: "Restroom (per fixture set)", sqftPerHour: 500, frequency: "WEEKLY" }],
    laborRate: 32, suppliesPct: 8, overheadPct: 15, targetMarginPct: 35,
  }
  await systemDb.estimate.create({
    data: {
      organizationId: orgId, title: "TechNova HQ — 3x/week", status: "SENT", pricing: "PER_VISIT", rate: "1850.00", total: "1850.00", subtotal: "1850.00",
      validUntil: days(14), contactName: "Omar Haddad", siteName: "TechNova HQ", city: "Austin", state: "TX",
      bidWorksheet: { inputs: bidInputs, result: { price: "1850.00", totalCost: "1202.50", margin: "647.50", marginPct: "35.0", monthlyHours: "48.2", laborCost: "1040.00", suppliesCost: "83.20", overheadCost: "168.48" }, computedAt: new Date().toISOString() },
      lines: { create: [{ description: "Office cleaning 3x/week", quantity: "1", unitRate: "1850.00", amount: "1850.00", sortOrder: 0 }] },
    },
  })
  await systemDb.estimate.create({
    data: {
      organizationId: orgId, title: `${commCustomer.name} — accepted`, status: "ACCEPTED", pricing: "PER_VISIT", rate: "900.00", total: "900.00", subtotal: "900.00",
      customerId: commCustomer.id, convertedCustomerId: commCustomer.id, convertedAt: days(-10),
      lines: { create: [{ description: "Accepted scope", quantity: "1", unitRate: "900.00", amount: "900.00", sortOrder: 0 }] },
    },
  })

  // ── A contract expiring within the warning window (default 60d) ──
  await systemDb.contract.create({
    data: { organizationId: orgId, customerId: commCustomer.id, title: `${commCustomer.name} — renewal pending`, startDate: days(-320), endDate: days(28), contractValue: "48000.00", billingFrequency: "MONTHLY", status: "ACTIVE" },
  })

  // ── Assets + maintenance (one in MAINTENANCE) ──
  const assetDefs: { name: string; category: "EQUIPMENT" | "VEHICLE" | "MACHINE"; status: "ACTIVE" | "MAINTENANCE" }[] = [
    { name: "Auto-scrubber #1", category: "MACHINE", status: "ACTIVE" },
    { name: "Backpack vacuum #3", category: "EQUIPMENT", status: "ACTIVE" },
    { name: "Service Van (Ford Transit)", category: "VEHICLE", status: "MAINTENANCE" },
  ]
  for (const a of assetDefs) {
    const asset = await systemDb.asset.create({
      data: { organizationId: orgId, name: a.name, category: a.category, status: a.status, serial: `SN-${stamp % 100000}-${a.name.length}`, purchaseDate: days(-500), purchaseCost: "4200.00", assignedToSiteId: commSite.id },
      select: { id: true },
    })
    await systemDb.assetMaintenance.create({ data: { assetId: asset.id, date: days(-45), type: "Routine service", cost: "180.00", notes: "Filters replaced; pads rotated.", performedById: staff.supervisorIds[0] } })
    if (a.status === "MAINTENANCE") await systemDb.assetMaintenance.create({ data: { assetId: asset.id, date: days(-3), type: "Repair", cost: "640.00", notes: "Brake service — in shop.", performedById: staff.managerId } })
  }

  // ── Credentials: expiring soon + expired + valid; a site requirement ──
  await systemDb.credential.create({ data: { organizationId: orgId, userId: cleaner, type: "BACKGROUND_CHECK", issueDate: days(-340), expiryDate: days(18), status: "ACTIVE" } }) // expiring soon
  await systemDb.credential.create({ data: { organizationId: orgId, userId: cleaner2, type: "INSURANCE", issueDate: days(-400), expiryDate: days(-12), status: "ACTIVE" } }) // expired
  await systemDb.credential.create({ data: { organizationId: orgId, userId: staff.supervisorIds[0], type: "CERTIFICATION", issueDate: days(-120), expiryDate: days(300), status: "ACTIVE" } }) // valid
  await systemDb.siteCredentialRequirement.create({ data: { organizationId: orgId, serviceLocationId: commSite.id, type: "BACKGROUND_CHECK" } })

  // ── Access items (keys/fobs/badges — NO codes; ACCESS_ENCRYPTION_KEY unset) ──
  await systemDb.accessItem.create({ data: { organizationId: orgId, serviceLocationId: commSite.id, type: "KEY", identifier: "Front door key #3", status: "ISSUED", holderUserId: cleaner, description: "Main entrance" } })
  await systemDb.accessItem.create({ data: { organizationId: orgId, serviceLocationId: commSite.id, type: "FOB", identifier: "Elevator fob A", status: "AVAILABLE" } })
  await systemDb.accessItem.create({ data: { organizationId: orgId, serviceLocationId: commSite.id, type: "BADGE", identifier: "Visitor badge 12", status: "AVAILABLE" } })

  // ── Coverage: an upcoming job whose assigned cleaner is unavailable → NEEDS COVERAGE ──
  // Anchor to tomorrow's UTC midnight so the job's date and the availability day
  // always match (adding hours to `now` could roll past midnight).
  const tomorrow = new Date(now)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  tomorrow.setUTCHours(0, 0, 0, 0)
  const coverStart = new Date(tomorrow.getTime() + 19 * 3600_000) // tomorrow 19:00 UTC — within 48h
  const coverDayKey = tomorrow.toISOString().slice(0, 10)
  const coverJob = await systemDb.job.create({
    data: {
      organizationId: orgId, serviceLocationId: commSite.id, title: "Tomorrow night — needs coverage", status: "ASSIGNED",
      scheduledStart: coverStart, scheduledEnd: new Date(coverStart.getTime() + 3 * 3600_000), crewSize: 2, createdById: staff.managerId,
      assignments: { create: [{ organizationId: orgId, userId: cleaner, status: "ASSIGNED" }] },
    },
    select: { id: true },
  })
  void coverJob
  await systemDb.availability.create({ data: { organizationId: orgId, userId: cleaner, startDate: new Date(`${coverDayKey}T00:00:00.000Z`), endDate: new Date(`${coverDayKey}T00:00:00.000Z`), reason: "Out sick", source: "MANAGER", createdById: staff.managerId } })
  // A pending time-off request to approve.
  await systemDb.timeOffRequest.create({ data: { organizationId: orgId, userId: cleaner2, startDate: days(6), endDate: days(8), reason: "Family trip", status: "PENDING" } })

  // ── Export history ──
  await systemDb.exportRun.create({ data: { organizationId: orgId, type: "QBO_INVOICES", periodStart: days(-60), periodEnd: days(-30), rowCount: 14, createdById: staff.ownerId, createdByName: staff.owner.name } })
  await systemDb.exportRun.create({ data: { organizationId: orgId, type: "GUSTO_HOURS", periodStart: days(-14), periodEnd: days(-1), rowCount: 9, createdById: staff.managerId, createdByName: "Morgan Manager" } })

  // ── Portal invite (so the customer's Portal Access section isn't empty) ──
  await systemDb.user.create({ data: { organizationId: orgId, customerId: commCustomer.id, name: "Portal Contact", email: `portal-${stamp}@client.demo`, password: "x", role: "CLIENT", isActive: false } })
  await systemDb.portalInvite.create({ data: { organizationId: orgId, customerId: commCustomer.id, email: `portal-${stamp}@client.demo`, token: `demo-invite-${stamp}`, status: "PENDING", invitedById: staff.managerId, expiresAt: days(7) } })

  // ── Invoices across remaining statuses (DRAFT, PAID, VOID, OVERDUE) ──
  const mkInv = async (status: "DRAFT" | "SENT" | "PAID" | "VOID", opts: { overdue?: boolean; amount?: string } = {}) => {
    const amount = opts.amount ?? "2400.00"
    const inv = await systemDb.invoice.create({
      data: {
        organizationId: orgId, customerId: commCustomer.id, invoiceNumber: nextInvoiceNo(), status,
        issueDate: opts.overdue ? days(-45) : days(-5), dueDate: opts.overdue ? days(-15) : days(25),
        periodStart: days(-35), periodEnd: days(-5), subtotal: amount, total: amount,
        lines: { create: [{ description: `${commCustomer.name} — service`, serviceDate: days(-10), quantity: "1", unitRate: amount, amount, billable: true }] },
      },
      select: { id: true, total: true },
    })
    return inv
  }
  await mkInv("DRAFT")
  const paid = await mkInv("PAID", { amount: "1800.00" })
  await systemDb.invoicePayment.create({ data: { invoiceId: paid.id, amount: "1800.00", method: "ACH", receivedDate: days(-2) } })
  await mkInv("VOID")
  await mkInv("SENT", { overdue: true }) // overdue: SENT with a past due date

  // ── Dashboard-tile triggers: an unassigned upcoming job, an understaffed job,
  //    and one completed-but-unapproved time entry (Time to approve). ──
  await systemDb.job.create({ data: { organizationId: orgId, serviceLocationId: commSite.id, title: "Unassigned — needs scheduling", status: "SCHEDULED", scheduledStart: new Date(now.getTime() + 2 * DAY + 19 * 3600_000), scheduledEnd: new Date(now.getTime() + 2 * DAY + 22 * 3600_000), crewSize: 2, createdById: staff.managerId } })
  const understaffed = await systemDb.job.create({ data: { organizationId: orgId, serviceLocationId: commSite.id, title: "Understaffed — 1 of 2", status: "ASSIGNED", scheduledStart: new Date(now.getTime() + 3 * DAY + 19 * 3600_000), scheduledEnd: new Date(now.getTime() + 3 * DAY + 22 * 3600_000), crewSize: 2, createdById: staff.managerId, assignments: { create: [{ organizationId: orgId, userId: cleaner2, status: "ASSIGNED" }] } }, select: { id: true } })
  void understaffed
  if (ctx.completedJobIds.length > 0) {
    await systemDb.timeEntry.create({ data: { organizationId: orgId, jobId: ctx.completedJobIds[ctx.completedJobIds.length - 1], userId: staff.cleanerIds[2], clockInAt: new Date(week.getTime() + todayOffset * DAY - DAY + 19 * 3600_000), clockOutAt: new Date(week.getTime() + todayOffset * DAY - DAY + 22 * 3600_000), breakMinutes: 15, status: "COMPLETED", clockInSource: "mobile_gps" } })
  }

  // ── Quote requests across sources + statuses (Phase 17) ──
  const quoteDefs: { source: "PHONE" | "ONLINE" | "IN_PERSON" | "REFERRAL"; contactName: string; status: "NEW" | "CONTACTED" | "QUOTED" | "WON" | "LOST"; propertyType: "RESIDENTIAL" | "COMMERCIAL"; sqft: number; city: string; walk?: boolean }[] = [
    { source: "PHONE", contactName: "Jordan Blake", status: "NEW", propertyType: "RESIDENTIAL", sqft: 2200, city: "Austin" },
    { source: "ONLINE", contactName: "Westside Clinic", status: "CONTACTED", propertyType: "COMMERCIAL", sqft: 14000, city: "Round Rock" },
    { source: "IN_PERSON", contactName: "Lakeview Offices", status: "QUOTED", propertyType: "COMMERCIAL", sqft: 30000, city: "Austin", walk: true },
    { source: "REFERRAL", contactName: "The Okafors", status: "WON", propertyType: "RESIDENTIAL", sqft: 1800, city: "Cedar Park" },
    { source: "ONLINE", contactName: "Old Mill Lofts", status: "LOST", propertyType: "COMMERCIAL", sqft: 9000, city: "Austin" },
  ]
  for (const q of quoteDefs) {
    await systemDb.quoteRequest.create({
      data: {
        organizationId: orgId, source: q.source, contactName: q.contactName, contactPhone: "512-555-0147",
        contactEmail: `${q.contactName.toLowerCase().replace(/[^a-z]/g, "")}-${stamp}@quote.demo`,
        addressLine1: "500 Demo Ave", city: q.city, state: "TX", postalCode: "78701",
        propertyType: q.propertyType, sqft: q.sqft, frequency: q.propertyType === "COMMERCIAL" ? "WEEKLY" : "BIWEEKLY",
        status: q.status, notes: "Interested in a recurring plan.",
        walkthrough: q.walk ? [{ name: "Lobby", sqft: 4000, surface: "Hard floor" }, { name: "Open office", sqft: 20000, surface: "Carpet" }, { name: "Restrooms", sqft: 1200, surface: "Restroom" }] : undefined,
      },
    })
  }
}
