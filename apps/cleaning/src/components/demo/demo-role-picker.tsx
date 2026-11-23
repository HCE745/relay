import { switchDemoRole } from "@/lib/demo/actions"
import { DEMO_ROLES } from "@/lib/demo/roles"

// Demo-only perspective switcher. Rendered only inside demo sessions (the banner
// and the field header pass the current role). Each pill submits a server action
// that re-issues the demo session as a seeded user of that role — so the app
// then enforces that role's real permissions, nav and dashboards.
const LABEL: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  SUPERVISOR: "Supervisor",
  CLEANER: "Cleaner",
}

export function DemoRolePicker({ current, tone = "onBrand" }: { current: string; tone?: "onBrand" | "onLight" }) {
  const base =
    tone === "onBrand"
      ? { wrap: "text-white/90", active: "bg-white text-brand-800", idle: "bg-white/15 text-white hover:bg-white/25" }
      : { wrap: "text-slate-600", active: "bg-brand-700 text-white", idle: "bg-slate-100 text-slate-700 hover:bg-slate-200" }
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${base.wrap}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">View as</span>
      {DEMO_ROLES.map((role) => {
        const isCurrent = role === current
        return (
          <form key={role} action={switchDemoRole} className="inline">
            <input type="hidden" name="role" value={role} />
            <button
              type="submit"
              aria-pressed={isCurrent}
              title={`Switch to the ${LABEL[role]} experience`}
              className={`rounded-md px-2 py-0.5 text-xs font-semibold transition ${isCurrent ? base.active : base.idle}`}
            >
              {LABEL[role]}
            </button>
          </form>
        )
      })}
    </span>
  )
}
