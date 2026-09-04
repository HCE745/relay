import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { getPlatformConfig, setPlatformConfig } from "@/lib/platform-config"

export const dynamic = "force-dynamic"

const DISCOVERY_KEY = "ai_prospect_discovery_enabled"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

// GET — return singleton CrmSettings + platform config overrides
export async function GET() {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let settings = await prisma.crmSettings.findFirst()
  if (!settings) {
    settings = await prisma.crmSettings.create({ data: {} })
  }

  const discoveryVal = await getPlatformConfig(DISCOVERY_KEY)
  // Default enabled (empty string or "true" → true; only "false" → false)
  const aiProspectDiscoveryEnabled = discoveryVal !== "false"

  return NextResponse.json({ settings: { ...settings, aiProspectDiscoveryEnabled } })
}

// PATCH — update CrmSettings fields + platform config overrides
export async function PATCH(req: NextRequest) {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as Partial<{
    timezone:                  string
    sendingWindowStart:        number
    sendingWindowEnd:          number
    autoSendEnabled:           boolean
    aiProspectDiscoveryEnabled: boolean
  }>

  const { aiProspectDiscoveryEnabled, ...crmFields } = body

  let settings = await prisma.crmSettings.findFirst()
  if (!settings) {
    settings = await prisma.crmSettings.create({ data: {} })
  }

  if (Object.keys(crmFields).length > 0) {
    settings = await prisma.crmSettings.update({
      where: { id: settings.id },
      data:  crmFields,
    })
  }

  if (aiProspectDiscoveryEnabled !== undefined) {
    await setPlatformConfig(DISCOVERY_KEY, aiProspectDiscoveryEnabled ? "true" : "false")
  }

  const discoveryVal = await getPlatformConfig(DISCOVERY_KEY)
  return NextResponse.json({ settings: { ...settings, aiProspectDiscoveryEnabled: discoveryVal !== "false" } })
}
