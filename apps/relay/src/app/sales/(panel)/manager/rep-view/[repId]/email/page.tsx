import { redirect } from "next/navigation"
import { getManagerRepView } from "@/lib/manager-rep-auth"
import RepViewEmailClient from "./email-client"

export const dynamic = "force-dynamic"

export default async function RepViewEmailPage({
  params,
}: {
  params: Promise<{ repId: string }>
}) {
  const { repId } = await params

  const view = await getManagerRepView(repId)
  if (!view) redirect("/sales/manager/rep-view")

  const basePath = `/sales/manager/rep-view/${repId}`

  return (
    <RepViewEmailClient
      repId={repId}
      repName={view.viewingRep.name}
      basePath={basePath}
    />
  )
}
