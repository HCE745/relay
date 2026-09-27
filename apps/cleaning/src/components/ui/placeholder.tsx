// Lightweight server-safe building blocks for Phase 0 shell pages. These are
// intentionally minimal — real screens arrive in their respective phases.

// Consistent page header: title + optional subtitle on the left, an optional
// primary action right-aligned. `action` keeps every screen's header identical
// instead of each page hand-rolling its own flex row.
export function PageHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon ? (
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 [&>svg]:h-5 [&>svg]:w-5">
            {icon}
          </div>
        ) : null}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.7rem]">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}

export function Placeholder({
  title,
  phase,
  children,
}: {
  title: string
  phase: string
  children?: React.ReactNode
}) {
  return (
    <div>
      <PageHeader title={title} />
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm font-medium text-slate-700">Coming in {phase}</p>
        <p className="mt-1 text-sm text-slate-500">
          The shell and navigation are wired up; this screen is built in a later phase.
        </p>
        {children ? <div className="mt-4 text-left">{children}</div> : null}
      </div>
    </div>
  )
}

export function UpgradeNotice({ capability }: { capability: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
      <p className="text-base font-semibold text-amber-900">Not included in your plan</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-amber-800">
        This feature requires the <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[13px]">{capability}</code> capability.
        Upgrade your package to enable it.
      </p>
    </div>
  )
}
