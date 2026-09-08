import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { CustomerVoiceSettings } from "./settings-client"

export const dynamic = "force-dynamic"

export default async function CustomerVoiceSettingsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!["ADMIN", "HR"].includes(session.role)) redirect("/customer-voice")

  const org = await prisma.organization.findUnique({
    where:  { id: session.organizationId },
    select: { slug: true, name: true },
  })
  if (!org) redirect("/customer-voice")

  const locations = await prisma.location.findMany({
    where:   { organizationId: session.organizationId },
    select:  { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  })

  const apiKeys = await prisma.apiKey.findMany({
    where:   { organizationId: session.organizationId, isActive: true },
    select:  { id: true, name: true, keyPrefix: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })

  return (
    <CustomerVoiceSettings
      orgSlug={org.slug ?? ""}
      orgName={org.name}
      locations={locations.map(l => ({ id: l.id, name: l.name, slug: l.slug ?? "" }))}
      apiKeys={apiKeys.map(k => ({ id: k.id, name: k.name, keyPrefix: k.keyPrefix, createdAt: k.createdAt.toISOString() }))}
    />
  )
}
