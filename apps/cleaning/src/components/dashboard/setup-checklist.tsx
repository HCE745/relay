import Link from "next/link"
import type { SetupProgress } from "@/lib/data/setup"
import { dismissSetupGuide } from "@/lib/setup-actions"
import { Card } from "@/components/ui/controls"
import { CheckCircleIcon, CircleIcon, SparklesIcon } from "@/components/ui/icons"

// First-run setup guide. Steps derive completion from real data (SetupProgress);
// unfinished steps deep-link to the screen that completes them. The whole block
// is hidden by the caller once complete or dismissed.
export function SetupChecklist({ progress }: { progress: SetupProgress }) {
  const { steps, firstCustomerId, firstSiteId, firstSiteCustomerId } = progress
  const customerHref = firstCustomerId ? `/customers/${firstCustomerId}` : "/customers"
  const siteHref =
    firstSiteId && firstSiteCustomerId ? `/customers/${firstSiteCustomerId}/sites/${firstSiteId}` : customerHref

  const items: Array<{ label: string; done: boolean; href: string }> = [
    { label: "Add your first customer", done: steps.customer, href: "/customers" },
    { label: "Add a service location", done: steps.location, href: customerHref },
    { label: "Create a scope of work", done: steps.scope, href: siteHref },
    { label: "Add your team", done: steps.team, href: "/team" },
    { label: "Create a recurring service plan", done: steps.plan, href: siteHref },
    { label: "Assign your first job", done: steps.assignedJob, href: "/schedule" },
  ]

  const pct = Math.round((progress.completed / progress.total) * 100)

  return (
    <Card className="mb-8 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <SparklesIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Finish setting up your workspace</h2>
            <p className="text-xs text-slate-500">
              {progress.completed} of {progress.total} steps done · {pct}%
            </p>
          </div>
        </div>
        <form action={dismissSetupGuide}>
          <button
            type="submit"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            Dismiss
          </button>
        </form>
      </div>

      <div className="h-1.5 w-full bg-slate-100">
        <div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ol className="divide-y divide-slate-100">
        {items.map((item, i) => (
          <li key={i}>
            {item.done ? (
              <div className="flex items-center gap-3 px-5 py-3">
                <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-500" />
                <span className="text-sm text-slate-400 line-through">{item.label}</span>
              </div>
            ) : (
              <Link
                href={item.href}
                className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50"
              >
                <CircleIcon className="h-5 w-5 shrink-0 text-slate-300" />
                <span className="text-sm font-medium text-slate-800">{item.label}</span>
                <span className="ml-auto text-sm text-slate-400">→</span>
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  )
}
