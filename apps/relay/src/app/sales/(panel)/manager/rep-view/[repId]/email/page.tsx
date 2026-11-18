import { redirect } from "next/navigation"
import { getManagerRepView } from "@/lib/manager-rep-auth"
import { Mail } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function RepViewEmailPage({
  params,
}: {
  params: Promise<{ repId: string }>
}) {
  const { repId } = await params

  const view = await getManagerRepView(repId)
  if (!view) redirect("/sales/manager/rep-view")

  return (
    <div className="p-6">
      <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-6 py-10 text-center">
        <Mail className="w-8 h-8 text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-400">Email view coming in Stage C.</p>
      </div>
    </div>
  )
}
