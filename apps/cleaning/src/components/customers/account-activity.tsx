import Link from "next/link"
import { Card, StatusBadge } from "@/components/ui/controls"
import { formatMoney } from "@/lib/money"
import type { CustomerActivity } from "@/lib/data/customer-activity"

const titleize = (s: string) => s.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
const fmtDate = (d: Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  COMPLETED: "success", ACTIVE: "success", VERIFIED: "success", RESOLVED: "success", CLOSED: "neutral",
  SCHEDULED: "info", ASSIGNED: "info", IN_PROGRESS: "info", DRAFT: "neutral", REQUESTED: "warning",
  OPEN: "warning", ACKNOWLEDGED: "warning", CANCELLED: "neutral", FAIL: "danger", PASS: "success",
}
const tone = (s?: string | null) => (s ? STATUS_TONE[s] ?? "neutral" : "neutral")

function Section({ title, count, href, children }: { title: string; count: number; href: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title} <span className="text-slate-400">({count})</span></h3>
        <Link href={href} className="text-xs font-medium text-brand hover:underline">View all →</Link>
      </div>
      {children}
    </Card>
  )
}
function LinkRow({ href, label, right }: { href: string; label: string; right?: React.ReactNode }) {
  return (
    <li className="py-1.5">
      <Link href={href} className="flex items-center justify-between gap-2 text-sm hover:text-brand">
        <span className="min-w-0 truncate text-slate-800">{label}</span>
        {right ? <span className="shrink-0">{right}</span> : null}
      </Link>
    </li>
  )
}
const Empty = ({ text }: { text: string }) => <p className="text-sm text-slate-400">{text}</p>

export function CustomerAccountActivity({
  customerId, activity, caps,
}: {
  customerId: string
  activity: CustomerActivity
  caps: { jobs: boolean; contracts: boolean; estimates: boolean; inspections: boolean; issues: boolean; workOrders: boolean; servicePlans: boolean }
}) {
  const a = activity
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-700">Account activity</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {caps.jobs ? (
          <Section title="Jobs & schedule" count={a.jobs.count} href={`/jobs`}>
            {a.jobs.items.length === 0 ? <Empty text="No jobs yet." /> : (
              <ul className="divide-y divide-slate-100">{a.jobs.items.map((j) => <LinkRow key={j.id} href={`/jobs/${j.id}`} label={`${j.serviceLocation.name} · ${j.title}`} right={<span className="flex items-center gap-2 text-xs text-slate-400">{fmtDate(j.scheduledStart)}<StatusBadge tone={tone(j.status)}>{titleize(j.status)}</StatusBadge></span>} />)}</ul>
            )}
          </Section>
        ) : null}

        {caps.servicePlans ? (
          <Section title="Service plans" count={a.plans.length} href={`/customers/${customerId}`}>
            {a.plans.length === 0 ? <Empty text="No service plans." /> : (
              <ul className="divide-y divide-slate-100">{a.plans.map((p) => <LinkRow key={p.id} href={`/customers/${customerId}/sites/${p.serviceLocation.id}`} label={`${p.serviceLocation.name} · ${titleize(p.frequency)}`} right={<StatusBadge tone={p.isActive ? "success" : "neutral"}>{p.isActive ? "Active" : "Inactive"}</StatusBadge>} />)}</ul>
            )}
          </Section>
        ) : null}

        {caps.contracts ? (
          <Section title="Contracts" count={a.contracts.count} href={`/contracts`}>
            {a.contracts.items.length === 0 ? <Empty text="No contracts." /> : (
              <ul className="divide-y divide-slate-100">{a.contracts.items.map((c) => <LinkRow key={c.id} href={`/contracts/${c.id}`} label={c.title} right={<span className="flex items-center gap-2 text-xs text-slate-400">{c.contractValue ? formatMoney(c.contractValue) : ""}<StatusBadge tone={tone(c.status)}>{titleize(c.status)}</StatusBadge></span>} />)}</ul>
            )}
          </Section>
        ) : null}

        {caps.estimates ? (
          <Section title="Estimates & quotes" count={a.estimates.count} href={`/estimates`}>
            {a.estimates.items.length === 0 ? <Empty text="No estimates." /> : (
              <ul className="divide-y divide-slate-100">{a.estimates.items.map((e) => <LinkRow key={e.id} href={`/estimates/${e.id}`} label={e.title} right={<StatusBadge tone={tone(e.status)}>{titleize(e.status)}</StatusBadge>} />)}</ul>
            )}
          </Section>
        ) : null}

        {caps.inspections ? (
          <Section title="Inspections & quality" count={a.inspections.count} href={`/inspections`}>
            {a.inspections.items.length === 0 ? <Empty text="No inspections." /> : (
              <ul className="divide-y divide-slate-100">{a.inspections.items.map((i) => <LinkRow key={i.id} href={`/inspections/${i.id}`} label={`${i.templateName} · ${fmtDate(i.createdAt)}`} right={<StatusBadge tone={tone(i.outcome ?? i.status)}>{titleize(i.outcome ?? i.status)}</StatusBadge>} />)}</ul>
            )}
          </Section>
        ) : null}

        {caps.issues ? (
          <Section title="Issues & complaints" count={a.issues.count} href={`/issues`}>
            {a.issues.items.length === 0 ? <Empty text="No issues." /> : (
              <ul className="divide-y divide-slate-100">{a.issues.items.map((i) => <LinkRow key={i.id} href={`/issues/${i.id}`} label={(i.title ?? i.description).slice(0, 48)} right={<StatusBadge tone={tone(i.status)}>{titleize(i.status)}</StatusBadge>} />)}</ul>
            )}
          </Section>
        ) : null}

        {caps.workOrders ? (
          <Section title="Work orders & corrective" count={a.workOrders.count} href={`/work-orders`}>
            {a.workOrders.items.length === 0 ? <Empty text="No work orders." /> : (
              <ul className="divide-y divide-slate-100">{a.workOrders.items.map((w) => <LinkRow key={w.id} href={`/work-orders/${w.id}`} label={w.description.slice(0, 48)} right={<StatusBadge tone={tone(w.status)}>{titleize(w.status)}</StatusBadge>} />)}</ul>
            )}
          </Section>
        ) : null}
      </div>
    </section>
  )
}
