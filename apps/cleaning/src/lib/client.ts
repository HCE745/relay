// Client-side fetch helper for the JSON API routes. Returns a discriminated
// result so form components can show inline errors without try/catch noise.

export type ApiResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; details?: unknown; unmet?: string[] }

export async function apiSend<T = unknown>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<ApiResult<T>> {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    return {
      ok: false,
      error: (data && data.error) || "Request failed",
      details: data?.details,
      unmet: Array.isArray(data?.unmet) ? data.unmet : undefined,
    }
  }
  return { ok: true, data: data as T }
}
