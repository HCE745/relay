import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { AnomalyReview } from "@/components/anomalies/AnomalyReview"

export const dynamic = "force-dynamic"

export default async function AnomaliesPage() {
  const { tenantId, entityId } = await getEntityContext()

  const raw = await prisma.anomalyFlag.findMany({
    where: { tenantId, entityId, status: "OPEN" },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
  })

  // Serialize Date objects → ISO strings for the client component
  const flags = raw.map((f) => ({
    ...f,
    createdAt: f.createdAt.toISOString(),
    dismissedAt: f.dismissedAt?.toISOString() ?? null,
  }))

  return <AnomalyReview initialFlags={flags} entityId={entityId} />
}
