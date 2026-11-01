import { ok, parseBody, forbidden } from "@/lib/api"
import { kioskSessionSchema } from "@/lib/zod-schemas"
import { authenticateKiosk, kioskRoster } from "@/lib/data/kiosks"

// PUBLIC (middleware allows /api/kiosk): authenticated by the device token, not
// a staff session. Returns the kiosk config + current roster for the device.
export async function POST(request: Request) {
  const body = await parseBody(kioskSessionSchema, request)
  if (!body.ok) return body.response
  const kiosk = await authenticateKiosk(body.data.kioskId, body.data.token)
  if (!kiosk) return forbidden("This kiosk is not recognized or has been deactivated")
  const roster = await kioskRoster(kiosk)
  return ok({
    kiosk: { id: kiosk.id, name: kiosk.name, pinRequired: kiosk.pinRequired, photoRequired: kiosk.photoRequired },
    roster,
  })
}
