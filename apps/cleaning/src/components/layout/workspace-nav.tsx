"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { AdminNavItem } from "@/lib/rbac"

// Secondary navigation + breadcrumbs for the ERP shell. Both derive purely from
// the current path and the (already role/capability-filtered) nav list passed by
// the layout, so they never show a destination the user can't reach.

/** The nav item whose href best matches the current path (longest prefix wins). */
function matchItem(nav: AdminNavItem[], pathname: string): AdminNavItem | null {
  let best: AdminNavItem | null = null
  for (const item of nav) {
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      if (!best || item.href.length > best.href.length) best = item
    }
  }
  return best
}

/** Breadcrumb trail: Workspace › Page (› Details when on a record sub-route). */
export function Breadcrumbs({ nav }: { nav: AdminNavItem[] }) {
  const pathname = usePathname()
  const item = matchItem(nav, pathname)
  if (!item) return null
  const onDetail = pathname !== item.href && pathname.startsWith(item.href + "/")

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-slate-500">
      {item.section ? <span className="shrink-0 font-medium text-slate-400">{item.section}</span> : null}
      {item.section ? <span className="shrink-0 text-slate-300">/</span> : null}
      {onDetail ? (
        <Link href={item.href} className="shrink-0 font-medium text-slate-600 hover:text-brand">{item.label}</Link>
      ) : (
        <span className="truncate font-semibold text-slate-800">{item.label}</span>
      )}
      {onDetail ? <span className="shrink-0 text-slate-300">/</span> : null}
      {onDetail ? <span className="truncate font-semibold text-slate-800">Details</span> : null}
    </nav>
  )
}

/** Tabs for the sibling pages of the active workspace (hidden for 1-item ones). */
export function WorkspaceSubnav({ nav }: { nav: AdminNavItem[] }) {
  const pathname = usePathname()
  const item = matchItem(nav, pathname)
  if (!item?.section) return null
  const siblings = nav.filter((n) => n.section === item.section)
  if (siblings.length < 2) return null

  return (
    <div className="-mb-px flex gap-1 overflow-x-auto">
      {siblings.map((s) => {
        const active = s.href === item.href
        return (
          <Link
            key={`${s.key}:${s.href}`}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
              active
                ? "border-brand text-brand-800"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
            }`}
          >
            {s.label}
          </Link>
        )
      })}
    </div>
  )
}
