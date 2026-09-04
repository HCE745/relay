"use client"

import { useState } from "react"
import { Moon, Sun } from "lucide-react"

export function DarkModeToggle({ initialDarkMode }: { initialDarkMode: boolean }) {
  const [dark, setDark] = useState(initialDarkMode)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    const next = !dark
    setSaving(true)
    const res = await fetch("/api/account/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ darkMode: next }),
    })
    setSaving(false)
    if (res.ok) {
      setDark(next)
      if (next) {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {dark ? <Moon className="w-4 h-4 text-indigo-500" /> : <Sun className="w-4 h-4 text-amber-500" />}
        <div>
          <p className="text-sm font-medium text-gray-900">Dark Mode</p>
          <p className="text-xs text-gray-500">Switch to a darker interface theme</p>
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        aria-label="Toggle dark mode"
        className={`relative w-10 h-6 rounded-full transition-colors ${dark ? "bg-indigo-600" : "bg-gray-300"} disabled:opacity-60`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${dark ? "translate-x-4" : ""}`} />
      </button>
    </div>
  )
}
