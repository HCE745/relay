"use client"

import { useState } from "react"
import { THEMES, THEME_COOKIE, normalizeTheme, type ThemeId } from "@/lib/theme"

// Applies a theme immediately (data-theme on <html>) and persists it in a
// cookie, so the server re-renders with the right theme on the next load (no
// flash). Presentation only — no network call, no business logic.
function applyTheme(id: ThemeId) {
  if (typeof document === "undefined") return
  document.documentElement.dataset.theme = id
  document.cookie = `${THEME_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`
}

export function ThemeSwitcher({ current, variant = "settings" }: { current: ThemeId; variant?: "settings" | "menu" }) {
  const [theme, setTheme] = useState<ThemeId>(current)
  function choose(id: ThemeId) {
    setTheme(id)
    applyTheme(id)
  }

  if (variant === "menu") {
    // Compact segmented control for the account menu in the sidebar footer.
    return (
      <div className="mb-2 px-1">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Theme</div>
        <div role="radiogroup" aria-label="Theme" className="flex gap-1 rounded-lg bg-white/5 p-1">
          {THEMES.map((t) => {
            const active = theme === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => choose(t.id)}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                  active ? "bg-brand-700 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {t.id === "default" ? "Default" : "Victorian"}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Full radio-card picker for the settings page.
  return (
    <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-2">
      {THEMES.map((t) => {
        const active = theme === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(t.id)}
            className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
              active ? "border-brand bg-brand-50" : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <span className="mt-0.5 flex shrink-0 overflow-hidden rounded-md ring-1 ring-slate-300" aria-hidden="true">
              {t.swatches.map((c) => (
                <span key={c} className="h-9 w-4" style={{ backgroundColor: c }} />
              ))}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{t.label}</span>
                {active ? <span className="text-xs font-medium text-brand-700">Selected</span> : null}
              </span>
              <span className="mt-0.5 block text-sm text-slate-500">{t.description}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export { normalizeTheme }
