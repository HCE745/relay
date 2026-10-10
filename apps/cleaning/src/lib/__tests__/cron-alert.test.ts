import { describe, it, expect, beforeEach } from "vitest"
import { cronAuthorized, cronHttpStatus, cronAlertEmail, runCron } from "../cron-alert"

beforeEach(() => { process.env.CRON_SECRET = "s3cret"; delete process.env.CLEANING_OPS_ALERT_EMAIL })

describe("cronHttpStatus", () => {
  it("200 when clean, 500 when any unit failed", () => {
    expect(cronHttpStatus(0)).toBe(200)
    expect(cronHttpStatus(3)).toBe(500)
  })
})

describe("cronAuthorized", () => {
  const req = (h: Record<string, string>, url = "https://x/api/cron/x") => new Request(url, { headers: h })
  it("accepts the correct bearer token", () => expect(cronAuthorized(req({ authorization: "Bearer s3cret" }))).toBe(true))
  it("accepts ?secret= query", () => expect(cronAuthorized(req({}, "https://x/api/cron/x?secret=s3cret"))).toBe(true))
  it("rejects a wrong token", () => expect(cronAuthorized(req({ authorization: "Bearer nope" }))).toBe(false))
  it("rejects when CRON_SECRET is unset", () => { delete process.env.CRON_SECRET; expect(cronAuthorized(req({ authorization: "Bearer s3cret" }))).toBe(false) })
})

describe("cronAlertEmail", () => {
  it("returns null when no ops recipient is configured", () => {
    expect(cronAlertEmail("generate-jobs", "orgs=3 failed=1", ["o1: boom"])).toBeNull()
  })
  it("builds a recipient/subject/body when configured", () => {
    const email = cronAlertEmail("generate-jobs", "orgs=3 failed=1", ["o1: boom"], "ops@acme.test")
    expect(email).not.toBeNull()
    expect(email!.to).toBe("ops@acme.test")
    expect(email!.subject).toContain("generate-jobs")
    expect(email!.text).toContain("o1: boom")
  })
})

describe("runCron", () => {
  const authed = () => new Request("https://x/api/cron/x", { headers: { authorization: "Bearer s3cret" } })

  it("401s when unauthorized", async () => {
    const res = await runCron("x", new Request("https://x/api/cron/x"), async () => ({ failed: 0, line: "", body: {} }))
    expect(res.status).toBe(401)
  })
  it("200s on a clean run", async () => {
    const res = await runCron("x", authed(), async () => ({ failed: 0, line: "ok", body: { created: 2 } }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, created: 2 })
  })
  it("500s when the run reports failures (surfaces to Vercel)", async () => {
    const res = await runCron("x", authed(), async () => ({ failed: 2, line: "bad", failures: ["a", "b"], body: {} }))
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ ok: false })
  })
  it("500s (not crash) when the body throws", async () => {
    const res = await runCron("x", authed(), async () => { throw new Error("db down") })
    expect(res.status).toBe(500)
  })
})
