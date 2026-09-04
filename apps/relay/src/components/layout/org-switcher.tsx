"use client"

import { useState, useRef, useEffect } from "react"
import { Check, ChevronDown, Building2 } from "lucide-react"

interface OrgMembership {
  orgId: string
  orgName: string
  role: string
}

interface OrgSwitcherProps {
  currentOrgId: string
  currentOrgName: string
  memberships: OrgMembership[]
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  SUPERVISOR: "Supervisor",
  EMPLOYEE: "Employee",
  HR: "HR",
  VENDOR: "Vendor",
}

export function OrgSwitcher({ currentOrgId, currentOrgName, memberships }: OrgSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Hide if user only belongs to one org
  if (memberships.length <= 1) return null

  async function switchOrg(orgId: string) {
    if (orgId === currentOrgId || switching) return
    setSwitching(true)
    try {
      const res = await fetch("/api/auth/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      })
      if (res.ok) {
        window.location.reload()
      } else {
        const data = await res.json()
        console.error("Failed to switch org:", data.error)
        setSwitching(false)
      }
    } catch (err) {
      console.error("Switch org error:", err)
      setSwitching(false)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-60"
      >
        <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
        <span className="flex-1 truncate text-left">{currentOrgName}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-64 z-50 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1">
          <p className="px-3 pt-1 pb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Your Organizations
          </p>
          {memberships.map((m) => {
            const isCurrent = m.orgId === currentOrgId
            return (
              <button
                key={m.orgId}
                onClick={() => {
                  setOpen(false)
                  switchOrg(m.orgId)
                }}
                disabled={isCurrent || switching}
                className="flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:cursor-default"
              >
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium truncate">{m.orgName}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {ROLE_LABELS[m.role] ?? m.role}
                  </p>
                </div>
                {isCurrent && <Check className="h-4 w-4 shrink-0 text-blue-500" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
