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

export const customerCreateSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required").max(200),
  primaryContactName: optionalString,
  email: optionalEmail,
  phone: optionalString,
  billingAddress: optionalString,
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

export const servicePlanCreateSchema = z.object({
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
})
export const servicePlanUpdateSchema = servicePlanCreateSchema
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
  timezone: ianaTimezone,
})

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
