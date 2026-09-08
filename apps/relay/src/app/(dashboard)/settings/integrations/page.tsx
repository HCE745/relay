import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { IntegrationsClient } from "./integrations-client"

export const dynamic = "force-dynamic"

export default async function IntegrationsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.role !== "ADMIN") redirect("/dashboard")

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { api_webhooks_enabled: true, sso_foundation_enabled: true },
  })

  const [apiKeys, webhookEndpoints, ssoConfig, connectedAccountRaw, locationGroups] = await Promise.all([
    prisma.apiKey.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, keyPrefix: true, isActive: true,
        lastUsedAt: true, expiresAt: true, createdAt: true,
      },
    }),
    prisma.webhookEndpoint.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { deliveryLogs: true } } },
    }),
    org?.sso_foundation_enabled
      ? prisma.sSOConfig.findUnique({
          where: { organizationId: session.organizationId },
        })
      : Promise.resolve(null),
    prisma.connectedAccount.findUnique({
      where: { organizationId_provider: { organizationId: session.organizationId, provider: "google_business_profile" } },
      select: { accountEmail: true, lastSyncAt: true },
    }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT "sourceMetadata"->>'googleLocationId') AS count
      FROM "CustomerFeedback"
      WHERE "organizationId" = ${session.organizationId}
        AND "source" = 'GOOGLE_REVIEW'
        AND "sourceMetadata"->>'googleLocationId' IS NOT NULL
    `,
  ])

  return (
    <div>
      <Header title="Integrations" />
      <div className="p-6">
        <IntegrationsClient
          apiWebhooksEnabled={org?.api_webhooks_enabled ?? false}
          ssoEnabled={org?.sso_foundation_enabled ?? false}
          connectedAccount={connectedAccountRaw ? {
            email: connectedAccountRaw.accountEmail,
            lastSyncAt: connectedAccountRaw.lastSyncAt?.toISOString() ?? null,
            locationCount: Number(locationGroups[0]?.count ?? 0),
          } : null}
          initialApiKeys={apiKeys.map(k => ({
            id: k.id, name: k.name, keyPrefix: k.keyPrefix, isActive: k.isActive,
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
            expiresAt: k.expiresAt?.toISOString() ?? null,
            createdAt: k.createdAt.toISOString(),
          }))}
          initialWebhooks={webhookEndpoints.map(e => ({
            id: e.id, name: e.name, url: e.url, events: e.events,
            isActive: e.isActive, deliveryCount: e._count.deliveryLogs,
            createdAt: e.createdAt.toISOString(),
          }))}
          initialSSOConfig={ssoConfig ? {
            providerType: ssoConfig.providerType,
            clientId: ssoConfig.clientId,
            tenantIdOrDomain: ssoConfig.tenantIdOrDomain,
            ssoEnabled: ssoConfig.ssoEnabled,
            status: ssoConfig.status,
          } : null}
        />
      </div>
    </div>
  )
}
