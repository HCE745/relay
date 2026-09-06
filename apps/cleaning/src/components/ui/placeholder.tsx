// Lightweight server-safe building blocks for Phase 0 shell pages. These are
// intentionally minimal — real screens arrive in their respective phases.

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
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
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
      <p className="text-sm font-semibold text-amber-800">Not included in your plan</p>
      <p className="mt-1 text-sm text-amber-700">
        This feature requires the <code className="font-mono">{capability}</code> capability.
        Upgrade your package to enable it.
      </p>
    </div>
  )
}
