import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { experienceForRole } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { logout } from "@/lib/auth-actions"
import { FieldTabBar } from "@/components/field/field-tabbar"
import { FieldHelp } from "@/components/field/field-help"
import { DemoRolePicker } from "@/components/demo/demo-role-picker"
import { BRAND } from "@/lib/brand"

export const dynamic = "force-dynamic"

// The field app is a deliberately minimal, touch-first experience for cleaners.
// No ERP sidebar, no management navigation — one column, big targets.
export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect("/login")
  // Management roles never see the field app.
  if (experienceForRole(session.role) !== "field") redirect("/dashboard")

  // Field app ACCESS is an entitlement (workforce.mobileFieldApp), enforced here
  // at the single entry point for every field page — so the capability actually
  // gates access rather than being merely declarative. A cleaner whose org lacks
  // it (e.g. revoked via override, or a tier below Essentials) has nowhere else
  // to land — management pages bounce them — so we render a plain in-shell notice
  // with sign-out instead of redirecting into a loop.
  if (!(await orgHasCapability(session.organizationId, "workforce.mobileFieldApp"))) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Field app not enabled</h1>
        <p className="text-sm text-slate-600">
          Your organization’s plan does not include mobile field access. Please contact your
          administrator.
        </p>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Sign out
          </button>
        </form>
      </div>
    )
  }

  return (
    // Mobile-first, but NOT forced to phone width on larger screens — the column
    // widens on tablet/desktop so the field app is a real responsive workspace.
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50 sm:max-w-2xl lg:max-w-4xl">
      <header className="pt-safe sticky top-0 z-10 bg-brand text-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/70">{BRAND.name}</div>
            <div className="text-sm font-semibold">{session.name}</div>
          </div>
          <div className="flex items-center gap-2">
            <FieldHelp />
            <form action={logout}>
              <button type="submit" className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      {session.isDemo ? (
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-brand-200 bg-brand-50 px-3 py-1.5">
          <DemoRolePicker current={session.role} tone="onLight" />
        </div>
      ) : null}
      <main className="flex-1 px-4 py-4">{children}</main>
      <FieldTabBar />
    </div>
  )
}
