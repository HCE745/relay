import { NextResponse } from "next/server"
import { sendEmailSafe } from "./email"

// Cron authorization + failure alerting, with NO new infrastructure.
//
// Two complementary signals so a failed run never "logs into the void":
//   1. The route returns HTTP 500 when the run had any failure. Vercel's own
//      cron dashboard marks non-2xx invocations as failed and can notify — free,
//      built in, always on.
//   2. If CLEANING_OPS_ALERT_EMAIL is set, we also send an alert through the
//      existing Resend email path (best-effort; degrades to a dev log when email
//      is unconfigured).

export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get("authorization")
  const qs = new URL(request.url).searchParams.get("secret")
  return header === `Bearer ${secret}` || qs === secret
}

/** 200 when the run was clean, 500 when any unit failed (surfaces to Vercel). */
export function cronHttpStatus(failed: number): 200 | 500 {
  return failed > 0 ? 500 : 200
}

/** Pure: the alert email to send, or null when no ops recipient is configured. */
export function cronAlertEmail(
  name: string,
  detail: string,
  failures: string[] = [],
  opsEmail: string | undefined = process.env.CLEANING_OPS_ALERT_EMAIL,
): { to: string; subject: string; text: string } | null {
  if (!opsEmail) return null
  const lines = [`Cron "${name}" reported a failure.`, "", detail]
  if (failures.length) lines.push("", "Failures:", ...failures.slice(0, 50).map((f) => `• ${f}`))
  return { to: opsEmail, subject: `[Cleaning] Cron failure: ${name}`, text: lines.join("\n") }
}

function alertCronFailure(name: string, detail: string, failures: string[] = []): void {
  const email = cronAlertEmail(name, detail, failures)
  if (email) sendEmailSafe(email)
}

type CronOutcome = { failed: number; line: string; failures?: string[]; body: Record<string, unknown> }

/**
 * Wrap a cron handler: enforce auth, run the body, emit one structured log line,
 * alert on any failure (email + 500), and turn a thrown error into an alert + 500
 * rather than a silent crash.
 */
export async function runCron(name: string, request: Request, fn: () => Promise<CronOutcome>): Promise<NextResponse> {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const started = Date.now()
  try {
    const r = await fn()
    const ms = Date.now() - started
    const ok = r.failed === 0
    console.log(`[cron:${name}] ${r.line} ms=${ms}`)
    if (!ok) alertCronFailure(name, `${r.line} (ms=${ms})`, r.failures)
    return NextResponse.json({ ok, ...r.body }, { status: cronHttpStatus(r.failed) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[cron:${name}] THREW ${msg} ms=${Date.now() - started}`)
    alertCronFailure(name, `Run threw before completing: ${msg}`)
    return NextResponse.json({ ok: false, error: "Cron run failed" }, { status: 500 })
  }
}
