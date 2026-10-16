// Field photo upload with explicit, surfaced failure handling + retry.
//
// The field app's proof-of-service photo is the product's core value. The old
// path did `await fetch(...)` and ignored the result: a dropped connection threw
// (leaving the UI stuck) and a 4xx/5xx reverted silently, so a cleaner believed
// proof was captured when it wasn't. This helper NEVER throws — it returns a
// typed result the UI renders — and retries transient failures (network error
// or 5xx) while NOT retrying client errors (4xx won't improve on retry).

export type UploadResult = { ok: true } | { ok: false; error: string }

const NETWORK_ERROR = "Upload failed. Check your connection and retry."

export async function uploadPhoto(
  url: string,
  file: File,
  fields: Record<string, string>,
  opts: { retries?: number; fetchImpl?: typeof fetch } = {},
): Promise<UploadResult> {
  const retries = opts.retries ?? 1
  const doFetch = opts.fetchImpl ?? fetch
  let lastError = NETWORK_ERROR

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const form = new FormData()
      form.append("file", file)
      for (const [k, v] of Object.entries(fields)) form.append(k, v)
      const res = await doFetch(url, { method: "POST", body: form })
      if (res.ok) return { ok: true }

      const data = (await res.json().catch(() => null)) as { error?: unknown } | null
      lastError = typeof data?.error === "string" && data.error ? data.error : `Upload failed (${res.status}).`
      // Client errors (bad/oversized file, auth) are deterministic — don't retry.
      if (res.status >= 400 && res.status < 500) return { ok: false, error: lastError }
      // 5xx: fall through and retry.
    } catch {
      lastError = NETWORK_ERROR // thrown fetch = network/offline; retry.
    }
  }
  return { ok: false, error: lastError }
}
