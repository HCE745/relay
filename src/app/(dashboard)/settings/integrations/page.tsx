import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { FeatureFlagGate } from "@/components/layout/feature-flag-gate"
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

  if (!org?.api_webhooks_enabled && !org?.sso_foundation_enabled) {
    return (
      <div>
        <Header title="Integrations" />
        <FeatureFlagGate
          featureName="API & Integrations"
          description="Generate API keys, register webhook endpoints for real-time event notifications, and configure SSO. Contact support to enable."
        />
      </div>
    )
  }

  const [apiKeys, webhookEndpoints, ssoConfig] = await Promise.all([
    org.api_webhooks_enabled
      ? prisma.apiKey.findMany({
          where: { organizationId: session.organizationId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true, name: true, keyPrefix: true, isActive: true,
            lastUsedAt: true, expiresAt: true, createdAt: true,
          },
        })
      : Promise.resolve([]),
    org.api_webhooks_enabled
      ? prisma.webhookEndpoint.findMany({
          where: { organizationId: session.organizationId },
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { deliveryLogs: true } } },
        })
      : Promise.resolve([]),
    org.sso_foundation_enabled
      ? prisma.sSOConfig.findUnique({
          where: { organizationId: session.organizationId },
        })
      : Promise.resolve(null),
  ])

  return (
    <div>
      <Header title="Integrations" />
      <div className="p-6">
        <IntegrationsClient
          apiWebhooksEnabled={org.api_webhooks_enabled}
          ssoEnabled={org.sso_foundation_enabled}
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
