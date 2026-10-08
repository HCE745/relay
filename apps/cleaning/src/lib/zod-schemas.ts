import { z } from "zod"
import { isValidTimezone } from "./scheduling/timezones"

const ianaTimezone = z.string().refine(isValidTimezone, "Invalid IANA timezone")

// Request-boundary schemas. Handlers and server actions validate here so
// everything downstream works with typed, trusted input.

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  password: z.string().min(1, "Password is required"),
})
export type LoginInput = z.infer<typeof loginSchema>

export const paginationSchema = z.object({
  take: z.coerce.number().int().min(1).max(100).default(25),
  skip: z.coerce.number().int().min(0).default(0),
})
export type PaginationInput = z.infer<typeof paginationSchema>

// ─── Phase 1 write boundaries ────────────────────────────────────────────────
// organizationId is NEVER accepted from the client — it comes from the session
// via the org-scoped client. FK ids are validated to belong to the org in the
// data layer, not here.

const optionalString = z.string().trim().max(500).optional().or(z.literal("").transform(() => undefined))
const optionalEmail = z
  .string()
  .trim()
  .email()
  .optional()
  .or(z.literal("").transform(() => undefined))

export const PAYMENT_TERMS = ["DUE_ON_RECEIPT", "NET_15", "NET_30"] as const

// Money as a 2-decimal string so it reaches Prisma's Decimal without ever
// passing through a JS float. "" is treated as "not provided".
const money = z.string().trim().regex(/^\d{1,9}(\.\d{1,2})?$/, "Enter an amount like 120 or 120.50")
const optionalMoney = money.optional().or(z.literal("").transform(() => undefined))

export const customerCreateSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required").max(200),
  primaryContactName: optionalString,
  email: optionalEmail,
  phone: optionalString,
  billingAddress: optionalString,
  billingEmail: optionalEmail,
  paymentTerms: z.enum(PAYMENT_TERMS).optional(),
  notes: optionalString,
})
export const customerUpdateSchema = customerCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
})
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>

export const contactCreateSchema = z.object({
  customerId: z.string().min(1),
  name: z.string().trim().min(1, "Contact name is required").max(200),
  title: optionalString,
  email: optionalEmail,
  phone: optionalString,
  isPrimary: z.boolean().optional().default(false),
})
export const contactUpdateSchema = contactCreateSchema.omit({ customerId: true }).partial()
export type ContactCreateInput = z.infer<typeof contactCreateSchema>

export const serviceLocationCreateSchema = z.object({
  customerId: z.string().min(1),
  name: z.string().trim().min(1, "Site name is required").max(200),
  addressLine1: optionalString,
  addressLine2: optionalString,
  city: optionalString,
  state: optionalString,
  postalCode: optionalString,
  country: optionalString,
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  // A valid IANA zone sets an override; "" or null clears it (inherit org tz).
  timezone: ianaTimezone.nullish().or(z.literal("").transform(() => null)),
  siteContactName: optionalString,
  siteContactPhone: optionalString,
  siteContactEmail: optionalEmail,
  notes: optionalString,
})
export const serviceLocationUpdateSchema = serviceLocationCreateSchema
  .omit({ customerId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() })
export type ServiceLocationCreateInput = z.infer<typeof serviceLocationCreateSchema>

export const checklistItemSchema = z.object({
  label: z.string().trim().min(1, "Item label is required").max(300),
  instructions: optionalString,
  isRequired: z.boolean().optional().default(true),
  requirePhoto: z.boolean().optional().default(false),
})
export const checklistTemplateCreateSchema = z.object({
  name: z.string().trim().min(1, "Checklist name is required").max(200),
  description: optionalString,
  items: z.array(checklistItemSchema).min(1, "Add at least one checklist item"),
})
export const checklistTemplateUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: optionalString,
  isActive: z.boolean().optional(),
  // When items are supplied they REPLACE the set and bump the version.
  items: z.array(checklistItemSchema).min(1).optional(),
})
export type ChecklistTemplateCreateInput = z.infer<typeof checklistTemplateCreateSchema>

export const SERVICE_FREQUENCIES = [
  "ONE_TIME",
  "DAILY",
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "CUSTOM",
] as const

const timeString = z.string().regex(/^\d{1,2}:\d{2}$/, "Use HH:mm")
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")

export const BILLING_TYPES = ["FLAT_PER_JOB", "HOURLY"] as const
export const BILLING_MODES = ["PER_JOB", "FLAT_PERIOD"] as const
export const PERIOD_FREQUENCIES = ["MONTHLY", "QUARTERLY"] as const

export const servicePlanCreateSchema = z
  .object({
    serviceLocationId: z.string().min(1),
    name: z.string().trim().min(1, "Service plan name is required").max(200),
    frequency: z.enum(SERVICE_FREQUENCIES).default("WEEKLY"),
    rrule: optionalString,
    startTime: timeString.optional(),
    crewSize: z.coerce.number().int().min(1).max(100).default(1),
    defaultDurationMin: z.coerce.number().int().min(1).max(1440).optional(),
    checklistTemplateId: z.string().min(1).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    billingType: z.enum(BILLING_TYPES).optional(),
    rate: optionalMoney,
    currency: z.string().trim().length(3).toUpperCase().optional(),
    billingMode: z.enum(BILLING_MODES).optional(),
    periodAmount: optionalMoney,
    periodFrequency: z.enum(PERIOD_FREQUENCIES).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.billingMode === "FLAT_PERIOD") {
      if (v.periodAmount == null)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["periodAmount"], message: "A period amount is required for flat-period billing" })
      if (v.periodFrequency == null)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["periodFrequency"], message: "A billing frequency is required for flat-period billing" })
    }
  })
export const servicePlanUpdateSchema = servicePlanCreateSchema
  .innerType()
  .omit({ serviceLocationId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() })
export type ServicePlanCreateInput = z.infer<typeof servicePlanCreateSchema>

// ─── Phase 2: scheduling, jobs, assignments ──────────────────────────────────

export const generateJobsSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
})

export const manualJobCreateSchema = z.object({
  serviceLocationId: z.string().min(1),
  title: z.string().trim().min(1, "Job title is required").max(200),
  date: dateString,
  startTime: timeString,
  durationMin: z.coerce.number().int().min(1).max(1440).optional(),
  crewSize: z.coerce.number().int().min(1).max(100).optional(),
  checklistTemplateId: z.string().min(1).optional(),
  notes: optionalString,
})
export type ManualJobCreateInput = z.infer<typeof manualJobCreateSchema>

export const jobUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    notes: optionalString,
    crewSize: z.coerce.number().int().min(1).max(100).optional(),
    date: dateString.optional(),
    startTime: timeString.optional(),
  })
  // date and startTime must be provided together to reschedule.
  .refine((v) => (v.date ? !!v.startTime : true) && (v.startTime ? !!v.date : true), {
    message: "Provide both date and start time to reschedule",
  })
export type JobUpdateInput = z.infer<typeof jobUpdateSchema>

export const assignCleanerSchema = z.object({
  userId: z.string().min(1),
})

// ─── Phase 3: field execution ────────────────────────────────────────────────

export const orgSettingsSchema = z.object({
  timezone: ianaTimezone.optional(),
  contractExpiryLeadDays: z.coerce.number().int().min(1).max(365).optional(),
  credentialExpiryLeadDays: z.coerce.number().int().min(1).max(365).optional(),
  blockAssignmentOnExpiredCredential: z.boolean().optional(),
})

// ─── Compliance & credentials (Phase 13) ───
export const CREDENTIAL_TYPES = ["BACKGROUND_CHECK", "INSURANCE", "I9", "BONDING", "CERTIFICATION", "LICENSE", "TRAINING"] as const
export const CREDENTIAL_STATUSES = ["ACTIVE", "REVOKED"] as const

export const credentialCreateSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(CREDENTIAL_TYPES),
  issueDate: dateString.optional(),
  expiryDate: dateString.optional(),
  documentRef: optionalString,
  status: z.enum(CREDENTIAL_STATUSES).optional(),
  notes: optionalString,
})
export const credentialUpdateSchema = credentialCreateSchema.omit({ userId: true }).partial()

export const siteRequirementsSchema = z.object({ types: z.array(z.enum(CREDENTIAL_TYPES)) })

// ─── Key & access management (Phase 14) ───
export const ACCESS_ITEM_TYPES = ["KEY", "FOB", "CODE", "BADGE", "ALARM_CODE"] as const
export const accessItemCreateSchema = z.object({
  serviceLocationId: z.string().min(1),
  type: z.enum(ACCESS_ITEM_TYPES),
  identifier: z.string().trim().min(1).max(200),
  description: optionalString,
  secret: z.string().trim().min(1).max(500).optional(), // only for CODE/ALARM_CODE
})
export const accessItemUpdateSchema = z.object({
  identifier: z.string().trim().min(1).max(200).optional(),
  description: optionalString,
  secret: z.string().trim().min(1).max(500).optional(),
})
export const accessIssueSchema = z.object({ userId: z.string().min(1) })

// ─── Customer portal (Phase 16) ───
export const portalIssueSchema = z.object({
  serviceLocationId: z.string().min(1),
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().min(1, "Describe the problem").max(4000),
})
export const portalInviteSchema = z.object({
  customerId: z.string().min(1),
  email: z.string().email(),
})
export const accessActionSchema = z.object({ action: z.enum(["issue", "return", "lost"]), userId: z.string().min(1).optional() })

// Location is best-effort — clock-in/out succeeds even when it is absent.
export const clockSchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  accuracyM: z.coerce.number().min(0).optional(),
  source: z.enum(["web", "native", "manual"]).optional(),
})
export type ClockInput = z.infer<typeof clockSchema>

export const checklistItemUpdateSchema = z
  .object({
    isComplete: z.boolean().optional(),
    note: optionalString,
  })
  .refine((v) => v.isComplete !== undefined || v.note !== undefined, {
    message: "Nothing to update",
  })

export const ISSUE_CATEGORIES = [
  "QUALITY",
  "SAFETY",
  "EQUIPMENT",
  "SUPPLIES",
  "ACCESS",
  "CUSTOMER",
  "OTHER",
] as const

export const reportProblemSchema = z.object({
  category: z.enum(ISSUE_CATEGORIES).default("OTHER"),
  title: optionalString,
  description: z.string().trim().min(1, "Describe the problem").max(2000),
})
export type ReportProblemInput = z.infer<typeof reportProblemSchema>

// ─── Phase 4: inspections, time approval/correction, missed ──────────────────

export const inspectionItemSchema = z.object({
  label: z.string().trim().min(1, "Item label is required").max(300),
  instructions: optionalString,
  points: z.coerce.number().int().min(0).max(100).optional().default(1),
  isCritical: z.boolean().optional().default(false),
  requirePhoto: z.boolean().optional().default(false),
})
export const inspectionTemplateCreateSchema = z.object({
  name: z.string().trim().min(1, "Template name is required").max(200),
  passThreshold: z.coerce.number().int().min(0).max(100).optional().default(80),
  items: z.array(inspectionItemSchema).min(1, "Add at least one inspection item"),
})
export const inspectionTemplateUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  passThreshold: z.coerce.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  items: z.array(inspectionItemSchema).min(1).optional(),
})

export const createInspectionSchema = z.object({ templateId: z.string().min(1) })

export const INSPECTION_RESULTS = ["PASS", "FAIL", "NA"] as const
export const inspectionItemResultSchema = z
  .object({
    result: z.enum(INSPECTION_RESULTS).optional(),
    note: optionalString,
  })
  .refine((v) => v.result !== undefined || v.note !== undefined, { message: "Nothing to update" })

export const finalizeInspectionSchema = z.object({ comments: optionalString })

export const correctTimeSchema = z
  .object({
    clockInAt: z.coerce.date().optional(),
    clockOutAt: z.coerce.date().optional(),
    reason: z.string().trim().min(1, "A reason is required").max(500),
  })
  .refine((v) => v.clockInAt || v.clockOutAt, { message: "Provide a new clock-in or clock-out time" })
export type CorrectTimeInput = z.infer<typeof correctTimeSchema>

export const markMissedSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required").max(500),
})

// ─── Phase 5A: users, bootstrap, credentials, issues workflow ────────────────

const ROLE_ENUM = z.enum(["OWNER", "ADMIN", "MANAGER", "SUPERVISOR", "CLEANER"])
const PAY_TYPE = z.enum(["HOURLY", "SALARY"])
const password = z.string().min(8, "At least 8 characters").max(200)

export const userCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().toLowerCase().email(),
  phone: optionalString,
  role: ROLE_ENUM,
  password,
  employeeCode: optionalString,
  payType: PAY_TYPE.optional(),
  payRate: z.coerce.number().min(0).max(1_000_000).optional(),
  hireDate: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
})
export const userUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  phone: optionalString,
  role: ROLE_ENUM.optional(),
  isActive: z.boolean().optional(),
  employeeCode: optionalString,
  payType: PAY_TYPE.optional(),
  payRate: z.coerce.number().min(0).max(1_000_000).optional(),
  hireDate: z.coerce.date().optional(),
  employmentStatus: z.enum(["ACTIVE", "INACTIVE", "TERMINATED"]).optional(),
})
export const setPasswordSchema = z.object({ password })

export const registerOrgSchema = z.object({
  orgName: z.string().trim().min(1, "Company name is required").max(200),
  name: z.string().trim().min(1, "Your name is required").max(200),
  email: z.string().trim().toLowerCase().email(),
  password,
  timezone: ianaTimezone,
  bootstrapToken: z.string().min(1, "A setup code is required"),
})

export const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email() })
export const resetPasswordSchema = z.object({ token: z.string().min(1), password })
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: password,
})

export const assignIssueSchema = z.object({ assigneeId: z.string().min(1).nullable() })
export const issueStatusSchema = z.object({ status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED", "CLOSED"]) })
export const issueCommentSchema = z.object({ body: z.string().trim().min(1, "Write a note").max(2000) })

// ─── Phase 2: billing / invoices ─────────────────────────────────────────────

export const INVOICE_STATUSES = ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "VOID"] as const

export const generateInvoiceSchema = z
  .object({
    customerId: z.string().min(1),
    periodStart: dateString,
    periodEnd: dateString,
  })
  .refine((v) => v.periodStart <= v.periodEnd, { message: "End date must be on or after the start date" })
export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>

export const invoiceStatusSchema = z.object({ status: z.enum(INVOICE_STATUSES) })
// Manual transitions only — PAID / PARTIALLY_PAID derive from payments.
export const invoiceStatusActionSchema = z.object({ status: z.enum(["SENT", "VOID"]) })

export const invoicePaymentSchema = z.object({
  amount: money,
  receivedDate: dateString.optional(),
  method: optionalString,
  reference: optionalString,
})
export type InvoicePaymentInput = z.infer<typeof invoicePaymentSchema>

// ─── Phase 5: leads & estimates ──────────────────────────────────────────────

export const LEAD_STATUSES = ["NEW", "CONTACTED", "ESTIMATING", "WON", "LOST"] as const
export const ESTIMATE_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED"] as const
export const ESTIMATE_PRICING = ["PER_VISIT", "HOURLY"] as const

// ─── Multi-channel quoting (Phase 17) ───
export const QUOTE_SOURCES = ["PHONE", "ONLINE", "IN_PERSON", "REFERRAL"] as const
export const PROPERTY_TYPES = ["RESIDENTIAL", "COMMERCIAL"] as const
export const QUOTE_REQUEST_STATUSES = ["NEW", "CONTACTED", "QUOTED", "WON", "LOST"] as const

const walkthroughAreaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sqft: z.coerce.number().min(0).max(100_000_000),
  surface: z.string().trim().max(100).default(""),
  notes: optionalString,
})

const quoteBase = {
  contactName: z.string().trim().min(1, "Contact name is required").max(200),
  contactEmail: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  contactPhone: optionalString,
  addressLine1: optionalString,
  city: optionalString,
  state: optionalString,
  postalCode: optionalString,
  propertyType: z.enum(PROPERTY_TYPES).default("RESIDENTIAL"),
  sqft: z.coerce.number().int().min(0).max(100_000_000).optional(),
  frequency: z.enum(SERVICE_FREQUENCIES).optional(),
  notes: optionalString,
  requestedDate: dateString.optional(),
}

// Staff intake (phone / in-person / referral). `walkthrough` prefills the bid.
export const quoteRequestCreateSchema = z.object({
  source: z.enum(QUOTE_SOURCES).default("PHONE"),
  ...quoteBase,
  walkthrough: z.array(walkthroughAreaSchema).optional(),
})
export const quoteRequestUpdateSchema = z.object({ status: z.enum(QUOTE_REQUEST_STATUSES) })

// Public online booking — honeypot `website` must be empty; source forced ONLINE.
export const publicQuoteSchema = z.object({
  ...quoteBase,
  website: z.string().optional(), // honeypot
})

export const leadCreateSchema = z.object({
  name: z.string().trim().min(1, "Contact name is required").max(200),
  company: optionalString,
  email: optionalEmail,
  phone: optionalString,
  source: optionalString,
  status: z.enum(LEAD_STATUSES).optional(),
  notes: optionalString,
  assignedToId: z.string().min(1).optional(),
})
export const leadUpdateSchema = leadCreateSchema.partial()
export type LeadCreateInput = z.infer<typeof leadCreateSchema>

const estimateLineSchema = z.object({
  description: z.string().trim().min(1, "Line description is required").max(300),
  quantity: money, // decimal string, e.g. "1" or "3.5"
  unitRate: money,
})

export const estimateCreateSchema = z.object({
  leadId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  title: z.string().trim().min(1, "Estimate title is required").max(200),
  contactName: optionalString,
  contactEmail: optionalEmail,
  contactPhone: optionalString,
  siteName: optionalString,
  addressLine1: optionalString,
  city: optionalString,
  state: optionalString,
  postalCode: optionalString,
  frequency: z.enum(SERVICE_FREQUENCIES).optional(),
  pricing: z.enum(ESTIMATE_PRICING).optional(),
  rate: optionalMoney,
  currency: z.string().trim().length(3).toUpperCase().optional(),
  checklistTemplateId: z.string().min(1).optional(),
  validUntil: dateString.optional(),
  notes: optionalString,
  lines: z.array(estimateLineSchema).default([]),
})
export const estimateUpdateSchema = estimateCreateSchema.partial().extend({
  status: z.enum(ESTIMATE_STATUSES).optional(),
})
export type EstimateCreateInput = z.infer<typeof estimateCreateSchema>

export const estimateStatusSchema = z.object({ status: z.enum(ESTIMATE_STATUSES) })

// ─── Phase 8: contracts / service agreements ─────────────────────────────────

export const CONTRACT_STATUSES = ["DRAFT", "ACTIVE", "EXPIRED", "CANCELLED"] as const
// ─── Shift coverage (Phase 11) ───
export const unavailabilityCreateSchema = z
  .object({
    userId: z.string().min(1),
    startDate: dateString,
    endDate: dateString,
    reason: optionalString,
  })
  .refine((v) => v.endDate >= v.startDate, { path: ["endDate"], message: "End date must be on or after the start date" })

export const timeOffRequestSchema = z
  .object({
    startDate: dateString,
    endDate: dateString,
    reason: optionalString,
  })
  .refine((v) => v.endDate >= v.startDate, { path: ["endDate"], message: "End date must be on or after the start date" })

export const timeOffReviewSchema = z.object({ action: z.enum(["approve", "deny"]) })

export const reassignSchema = z.object({ fromUserId: z.string().min(1).optional(), toUserId: z.string().min(1) })

// ─── Bid calculator (Phase 10) ───
export const productionRateCreateSchema = z.object({
  taskType: z.string().trim().min(1).max(100),
  surfaceType: z.string().trim().min(1).max(100),
  sqftPerHour: z.coerce.number().positive().max(1_000_000),
})
export const productionRateUpdateSchema = productionRateCreateSchema.partial().extend({ isActive: z.boolean().optional() })

export const bidAreaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sqft: z.coerce.number().min(0).max(100_000_000),
  surfaceType: z.string().trim().max(100).default(""),
  sqftPerHour: z.coerce.number().positive().max(1_000_000),
  frequency: z.enum(SERVICE_FREQUENCIES),
})
export const bidInputsSchema = z.object({
  areas: z.array(bidAreaSchema).min(1, "Add at least one area"),
  laborRate: z.coerce.number().min(0).max(100_000),
  suppliesPct: z.coerce.number().min(0).max(100),
  overheadPct: z.coerce.number().min(0).max(100),
  targetMarginPct: z.coerce.number().min(0).max(99.9),
})

export const CONTRACT_BILLING_FREQUENCIES = ["MONTHLY", "QUARTERLY", "ANNUALLY", "ONE_TIME"] as const

export const contractCreateSchema = z.object({
  customerId: z.string().min(1),
  title: z.string().trim().min(1, "Contract title is required").max(200),
  startDate: dateString,
  endDate: dateString.optional(),
  autoRenew: z.boolean().optional(),
  contractValue: optionalMoney,
  billingFrequency: z.enum(CONTRACT_BILLING_FREQUENCIES).optional(),
  status: z.enum(CONTRACT_STATUSES).optional(),
  documentUrl: optionalString,
  notes: optionalString,
})
export const contractUpdateSchema = contractCreateSchema.omit({ customerId: true }).partial()
export type ContractCreateInput = z.infer<typeof contractCreateSchema>

// Replace the set of service plans linked to a contract (optional linking).
export const contractPlansSchema = z.object({ planIds: z.array(z.string().min(1)) })

// ─── Phase 6: assets & supplies ──────────────────────────────────────────────

export const ASSET_CATEGORIES = ["EQUIPMENT", "VEHICLE", "MACHINE"] as const
export const ASSET_STATUSES = ["ACTIVE", "MAINTENANCE", "RETIRED"] as const

// Signed money (adjustments can be negative). Positive money reuses `money`.
const signedMoney = z.string().trim().regex(/^-?\d{1,9}(\.\d{1,2})?$/, "Enter an amount like 5 or -2.5")

export const assetCreateSchema = z.object({
  name: z.string().trim().min(1, "Asset name is required").max(200),
  category: z.enum(ASSET_CATEGORIES).optional(),
  serial: optionalString,
  purchaseDate: dateString.optional(),
  purchaseCost: optionalMoney,
  status: z.enum(ASSET_STATUSES).optional(),
  assignedToSiteId: z.string().min(1).optional().or(z.literal("").transform(() => undefined)),
  assignedToUserId: z.string().min(1).optional().or(z.literal("").transform(() => undefined)),
})
export const assetUpdateSchema = assetCreateSchema.partial()
export type AssetCreateInput = z.infer<typeof assetCreateSchema>

export const assetMaintenanceSchema = z.object({
  type: z.string().trim().min(1, "What was done?").max(200),
  date: dateString.optional(),
  cost: optionalMoney,
  notes: optionalString,
})

export const supplyCreateSchema = z.object({
  name: z.string().trim().min(1, "Supply name is required").max(200),
  unit: z.string().trim().min(1).max(40).optional(),
  currentStock: optionalMoney, // opening stock
  reorderThreshold: optionalMoney,
  costPerUnit: optionalMoney,
})
export const supplyUpdateSchema = supplyCreateSchema.partial()
export type SupplyCreateInput = z.infer<typeof supplyCreateSchema>

// Manual stock adjustment with a required reason (signed delta). No purchasing.
export const supplyAdjustSchema = z.object({
  delta: signedMoney,
  reason: z.string().trim().min(1, "A reason is required").max(300),
})

// Cleaner-facing: log usage of a supply on a job (one tap + quantity).
export const supplyUsageSchema = z.object({
  supplyId: z.string().min(1),
  quantity: money,
  jobId: z.string().min(1).optional(),
})
export type SupplyUsageInput = z.infer<typeof supplyUsageSchema>
