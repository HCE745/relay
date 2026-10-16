import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageOrg } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listPayRules, payRuleOptions } from "@/lib/data/commission"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { CogIcon } from "@/components/ui/icons"
import { PayRulesManager, type PayRuleRow } from "@/components/pay/pay-rules-manager"

export const dynamic = "force-dynamic"
const CAP = "workforce.commissionPay"

export default async function PayRulesPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageOrg(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="Pay rules" /><UpgradeNotice capability={CAP} /></div>)
  }

  const [rules, options] = await Promise.all([listPayRules(orgId), payRuleOptions(orgId)])

  return (
    <div>
      <PageHeader title="Pay rules" subtitle="Commission and crew-based pay, computed per completed job" icon={<CogIcon />} />
      <div className="mb-4"><Link href="/settings" className="text-sm font-medium text-brand hover:underline">← Settings</Link></div>
      <PayRulesManager
        rules={rules as unknown as PayRuleRow[]}
        employees={options.employees}
        customers={options.customers}
        sites={options.sites}
        plans={options.plans}
      />
    </div>
  )
}
