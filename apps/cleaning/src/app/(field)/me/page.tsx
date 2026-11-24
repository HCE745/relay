import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { orgHasCapability } from "@/lib/page-guards"
import { getUserPrefs } from "@/lib/data/notifications"
import { isSmsConfigured } from "@/lib/sms"
import { TimeOffRequest } from "@/components/field/time-off-request"
import { NotificationPrefs } from "@/components/notifications/notification-prefs"
import {
  ClockIcon, CalendarIcon, ClipboardListIcon, ListChecksIcon, ChartBarIcon, TagIcon, HelpCircleIcon,
} from "@/components/ui/icons"

export const dynamic = "force-dynamic"

function Row({ href, label, hint, Icon }: { href: string; label: string; hint: string; Icon: (p: { className?: string }) => React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 active:bg-slate-50">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        <span className="block text-xs text-slate-400">{hint}</span>
      </span>
      <span className="text-slate-300">→</span>
    </Link>
  )
}

export default async function FieldMorePage() {
  const session = await getSession()
  if (!session) redirect("/login")
  const orgId = session.organizationId
  const [hasSops, hasPerformance, hasNotifications, hasCoverage, hasSupplies, prefs] = await Promise.all([
    orgHasCapability(orgId, "operations.sopLibrary"),
    orgHasCapability(orgId, "workforce.performanceAnalytics"),
    orgHasCapability(orgId, "workforce.notifications"),
    orgHasCapability(orgId, "workforce.coverage"),
    orgHasCapability(orgId, "supplies.inventory"),
    getUserPrefs(orgId, session.userId),
  ])
  const cleanerPrefs = prefs.filter((p) => p.roles === "all")

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{session.name}</h1>
        <p className="mt-0.5 text-sm text-slate-500">Your workspace</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Row href="/my-schedule" label="My schedule" hint="Upcoming jobs" Icon={CalendarIcon} />
        <Row href="/my-time" label="Clock history" hint="Hours & timekeeping" Icon={ClockIcon} />
        <Row href="/my-reports" label="Reports & concerns" hint="File & track workplace reports" Icon={ListChecksIcon} />
        {hasSops ? <Row href="/my-sops" label="Procedures & safety" hint="Read & acknowledge SOPs" Icon={ClipboardListIcon} /> : null}
        {hasPerformance ? <Row href="/my-work" label="My work & performance" hint="Completion & quality" Icon={ChartBarIcon} /> : null}
      </div>

      {hasSupplies ? (
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><TagIcon className="h-5 w-5" /></span>
          <div>
            <div className="text-sm font-semibold text-slate-900">Supplies</div>
            <div className="text-xs text-slate-400">Log supply usage and flag low stock from a job — open a job and use the Supplies panel.</div>
          </div>
        </div>
      ) : null}

      {hasCoverage ? (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Time off</h2>
          <TimeOffRequest />
        </div>
      ) : null}

      {hasNotifications ? (
        <details className="rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">Notification preferences</summary>
          <div className="mt-3"><NotificationPrefs initial={cleanerPrefs} smsAvailable={isSmsConfigured()} /></div>
        </details>
      ) : null}

      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><HelpCircleIcon className="h-5 w-5" /></span>
        <div>
          <div className="text-sm font-semibold text-slate-900">Help & feedback</div>
          <div className="text-xs text-slate-400">Tap the “?” at the top to report a problem or suggest an improvement.</div>
        </div>
      </div>
    </div>
  )
}
