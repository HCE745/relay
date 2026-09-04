"use client"

import { useTheme, type Theme } from "@/components/providers/ThemeProvider"
import { toast } from "sonner"

const THEMES: { id: Theme; label: string; subtitle: string; preview: string[] }[] = [
  {
    id: "contemporary",
    label: "Contemporary",
    subtitle: "Default — clean, modern, high-contrast",
    preview: ["#F8FAFC", "#FFFFFF", "#1D4ED8", "#0B1E3D"],
  },
  {
    id: "heritage",
    label: "Heritage",
    subtitle: "Warm cream, burgundy accent, serif headings",
    preview: ["#F5F2EA", "#FDFCF8", "#6B1F2A", "#1A1815"],
  },
]

export function ThemeSelector() {
  const { theme, setTheme } = useTheme()

  async function handleSelect(next: Theme) {
    if (next === theme) return
    await setTheme(next)
    toast.success(`Switched to ${THEMES.find((t) => t.id === next)?.label} theme`)
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {THEMES.map((t) => {
        const active = theme === t.id
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => handleSelect(t.id)}
            className="flex-1 text-left p-4 rounded transition-colors"
            style={{
              background:   active ? "var(--surface)" : "var(--background)",
              border:       `2px solid ${active ? "var(--accent)" : "var(--border)"}`,
              borderRadius: "var(--radius-card)",
              cursor:       "pointer",
            }}
          >
            {/* Color swatch strip */}
            <div className="flex gap-1.5 mb-3" aria-hidden>
              {t.preview.map((color, i) => (
                <div
                  key={i}
                  style={{
                    background:   color,
                    width:        i === 3 ? "1.75rem" : "1rem",
                    height:       "1.75rem",
                    borderRadius: "var(--radius-badge)",
                    border:       "1px solid rgba(0,0,0,0.08)",
                    flexShrink:   0,
                  }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 mb-0.5">
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--text-base)", fontFamily: "var(--font-heading)" }}
              >
                {t.label}
              </span>
              {active && (
                <span
                  className="badge badge-blue"
                  style={{ fontSize: "0.625rem" }}
                >
                  Active
                </span>
              )}
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {t.subtitle}
            </p>
          </button>
        )
      })}
    </div>
  )
}
