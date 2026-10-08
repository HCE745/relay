import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { WalkthroughCapture } from "@/components/quotes/walkthrough-capture"

export const dynamic = "force-dynamic"
const CAP = "crm.quoting"

export default async function WalkthroughPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (<div><PageHeader title="Walkthrough" /><UpgradeNotice capability={CAP} /></div>)
  }
  return (
    <div>
      <Link href="/quotes" className="mb-4 inline-block text-sm text-slate-500 hover:text-brand">← Quotes</Link>
      <PageHeader title="On-site walkthrough" subtitle="Capture areas room-by-room — feeds the bid calculator" />
      <WalkthroughCapture />
    </div>
  )
}
