import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { isPlatformAdmin } from "@/lib/platform-admin"

export const dynamic = "force-dynamic"

const NAV = [
  { href: "/platform", label: "Overview" },
  { href: "/platform/orgs", label: "Organizations" },
  { href: "/platform/demos", label: "Demos" },
  { href: "/feedback", label: "Product feedback" },
]

// CleanWare internal Super Admin portal — a trust boundary SEPARATE from customer
// organization management. Access is the email allowlist (isPlatformAdmin), never
// an org role; a customer OWNER has no access here. Its own minimal shell makes
// the separation obvious (no org nav, no org-scoped data).
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!isPlatformAdmin(session)) redirect("/dashboard")

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-brand-700 px-2 py-1 text-xs font-bold tracking-wide text-white">CleanWare</span>
            <span className="text-sm font-semibold text-slate-200">Super Admin</span>
          </div>
          <nav className="flex flex-wrap gap-1">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white">
                {n.label}
              </Link>
            ))}
            <Link href="/dashboard" className="ml-2 rounded-md px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-white">Exit ↗</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  )
}
