import { z } from "zod"

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

export const servicePlanCreateSchema = z.object({
  serviceLocationId: z.string().min(1),
  name: z.string().trim().min(1, "Service plan name is required").max(200),
  frequency: z.enum(SERVICE_FREQUENCIES).default("WEEKLY"),
  rrule: optionalString,
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
