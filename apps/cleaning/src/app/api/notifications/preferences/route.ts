import { getSession } from "@/lib/session"
import { unauthorized, ok, parseBody, runWrite } from "@/lib/api"
import { z } from "zod"
import { getUserPrefs, setUserPref, STAFF_NOTIFICATION_EVENTS } from "@/lib/data/notifications"

export async function GET() {
  const s = await getSession(); if (!s) return unauthorized()
  return ok(await getUserPrefs(s.organizationId, s.userId))
}

const EVENTS = STAFF_NOTIFICATION_EVENTS.map((e) => e.event) as [string, ...string[]]
const schema = z.object({ event: z.enum(EVENTS), email: z.boolean(), sms: z.boolean() })

export async function PATCH(request: Request) {
  const s = await getSession(); if (!s) return unauthorized()
  const body = await parseBody(schema, request); if (!body.ok) return body.response
  return runWrite(() => setUserPref(s.organizationId, s.userId, body.data.event as "JOB_ASSIGNED", { email: body.data.email, sms: body.data.sms }))
}
