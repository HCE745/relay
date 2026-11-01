import { parseBody, forbidden, runWrite } from "@/lib/api"
import { kioskPunchSchema } from "@/lib/zod-schemas"
import { authenticateKiosk, kioskPunch, kioskRoster } from "@/lib/data/kiosks"

// PUBLIC (middleware allows /api/kiosk): device-token authenticated. Verifies
// PIN/photo per the kiosk config, then clocks the employee in/out through the
// normal path (per-user TimeEntry + audit). Returns the result + fresh roster.
export async function POST(request: Request) {
  const body = await parseBody(kioskPunchSchema, request)
  if (!body.ok) return body.response
  const kiosk = await authenticateKiosk(body.data.kioskId, body.data.token)
  if (!kiosk) return forbidden("This kiosk is not recognized or has been deactivated")
  return runWrite(async () => {
    const result = await kioskPunch(kiosk, { userId: body.data.userId, pin: body.data.pin, photoRef: body.data.photoRef })
    const roster = await kioskRoster(kiosk)
    return { ...result, roster }
  })
}
