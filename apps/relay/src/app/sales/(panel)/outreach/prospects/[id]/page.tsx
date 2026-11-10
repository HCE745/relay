import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function ProspectDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) redirect("/sales/login")

  const { id } = await params
  redirect(`/sales/prospects/${id}`)
}
