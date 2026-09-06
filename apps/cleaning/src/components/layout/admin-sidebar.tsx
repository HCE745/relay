"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { logout } from "@/lib/auth-actions"
import type { AdminNavItem } from "@/lib/rbac"

export function AdminSidebar({
  nav,
  user,
  packageTier,
}: {
  nav: AdminNavItem[]
  user: { name: string; role: string }
  packageTier: string
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const links = (
    <nav className="flex-1 space-y-1 px-3">
      {nav.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/")
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-brand text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  const brand = (
    <div className="flex items-center gap-2 px-5 py-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
        C
      </div>
      <div>
        <div className="text-sm font-semibold text-white">HCE Cleaning</div>
        <div className="text-[11px] uppercase tracking-wide text-slate-400">{packageTier}</div>
      </div>
    </div>
  )

  const footer = (
    <div className="border-t border-slate-800 px-4 py-3">
      <div className="mb-2 px-1 text-sm text-slate-300">
        <div className="font-medium text-white">{user.name}</div>
        <div className="text-xs text-slate-400">{user.role}</div>
      </div>
      <form action={logout}>
        <button
          type="submit"
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          Sign out
        </button>
      </form>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <span className="font-semibold text-slate-900">HCE Cleaning</span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          aria-label="Toggle navigation"
        >
          Menu
        </button>
      </div>

      {/* Desktop fixed rail */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-slate-900 md:flex">
        {brand}
        {links}
        {footer}
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-slate-900">
            {brand}
            {links}
            {footer}
          </aside>
        </div>
      ) : null}
    </>
  )
}
