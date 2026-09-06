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
