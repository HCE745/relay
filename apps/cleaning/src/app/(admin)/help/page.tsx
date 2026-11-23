import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { BRAND } from "@/lib/brand"
import { PageHeader } from "@/components/ui/placeholder"
import { Card } from "@/components/ui/controls"
import { HelpCircleIcon } from "@/components/ui/icons"
import { HelpLaunchers } from "@/components/help/help-launchers"

export const dynamic = "force-dynamic"

const FAQ: { q: string; a: string }[] = [
  { q: "How do I schedule a recurring visit?", a: "Open a customer's service location and set a service plan (nightly, weekly, biweekly). The schedule fills itself from there — you set the cadence once." },
  { q: "How do I assign cleaners to a job?", a: "Open any job from Schedule or Jobs and assign cleaners. Availability and site history are shown so you staff it with the right people. Use Coverage to fill call-outs fast." },
  { q: "How does task verification work?", a: "Checklist items can be owned by a cleaner and require a proof photo. A supervisor reviews completed work and marks it verified or rejected; rejections go back for rework." },
  { q: "How do inspections and corrective work connect?", a: "Score a site against a template. A failing inspection opens a quality issue and can auto-create a non-billable corrective work order that's tracked to done, then re-inspected." },
  { q: "What happens when a customer complains?", a: "Log it under Customer complaints. Record a finding, attribute it fairly to the responsible task and people (only substantiated complaints count), and resolve it with a corrective work order." },
  { q: "How do I invoice completed work?", a: "Completed jobs become invoices automatically. Review, apply tax, and send a PDF or pay link. Record payments under Payments; chase overdue balances in AR Aging." },
]

export default async function HelpCenterPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader
        title="Help Center"
        subtitle={`Guides, walkthroughs and support for ${BRAND.name}`}
        icon={<HelpCircleIcon />}
      />

      <Card className="p-5">
        <HelpLaunchers />
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Frequently asked</h2>
        <Card className="divide-y divide-slate-100">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-4 py-3">
              <summary className="cursor-pointer list-none text-sm font-medium text-slate-900 marker:hidden">
                <span className="mr-2 text-slate-400 group-open:rotate-90 inline-block transition">›</span>
                {f.q}
              </summary>
              <p className="mt-2 pl-5 text-sm leading-relaxed text-slate-600">{f.a}</p>
            </details>
          ))}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-700">Still stuck?</h2>
        <p className="mt-1 text-sm text-slate-600">
          Use the <span className="font-medium">?</span> menu in the top bar any time to report a bug (with an
          optional screenshot or screen recording) or request a feature. Your message goes straight to the {BRAND.name} team.
        </p>
      </Card>
    </div>
  )
}
