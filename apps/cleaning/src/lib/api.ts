import { NextResponse } from "next/server"
import type { z } from "zod"
import { ReferenceError } from "./data/errors"

// Small helpers for API route handlers: consistent JSON errors + Zod parsing at
// the request boundary (query and body). Relay validates by hand-casting; we
// validate at the edge so handlers receive typed, trusted input.

export function ok<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init)
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function badRequest(details: unknown) {
  return NextResponse.json({ error: "Invalid request", details }, { status: 400 })
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 })
}

/**
 * Run a data-layer write, mapping a cross-org/missing reference to 400 and a
 * null "not found" result to 404. Other errors propagate to the platform.
 */
export async function runWrite<T>(
  fn: () => Promise<T>,
  opts: { created?: boolean } = {},
): Promise<NextResponse> {
  try {
    const result = await fn()
    if (result === null) return notFound()
    return ok(result, opts.created ? 201 : undefined)
  } catch (e) {
    if (e instanceof ReferenceError) return badRequest(e.message)
    throw e
  }
}

/** Parse+validate URL search params; returns typed data or a 400 Response. */
export function parseQuery<S extends z.ZodTypeAny>(
  schema: S,
  url: string,
): { ok: true; data: z.infer<S> } | { ok: false; response: NextResponse } {
  const params = Object.fromEntries(new URL(url).searchParams)
  const result = schema.safeParse(params)
  if (!result.success) return { ok: false, response: badRequest(result.error.flatten()) }
  return { ok: true, data: result.data }
}

/** Parse+validate a JSON request body; returns typed data or a 400 Response. */
export async function parseBody<S extends z.ZodTypeAny>(
  schema: S,
  request: Request,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { ok: false, response: badRequest("Body must be valid JSON") }
  }
  const result = schema.safeParse(raw)
  if (!result.success) return { ok: false, response: badRequest(result.error.flatten()) }
  return { ok: true, data: result.data }
}
