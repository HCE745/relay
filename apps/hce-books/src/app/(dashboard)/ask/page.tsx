import { getEntityContext } from "@/lib/entity-context"
import { AskPage } from "./AskPage"

export const dynamic = "force-dynamic"

export default async function AskPageWrapper() {
  const { entityId, selectedEntity, entities } = await getEntityContext()

  return (
    <AskPage
      entityId={entityId}
      entityName={selectedEntity?.name ?? entityId}
      entities={entities.map((e: { id: string; name: string }) => ({ id: e.id, name: e.name }))}
    />
  )
}
