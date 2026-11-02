// Presentation theme registry (Phase: theming). A theme is purely a token set
// (see globals.css). Preference is stored per browser in a cookie, read on the
// server in the root layout so the correct theme is applied with no flash.

export const THEMES = [
  {
    id: "default",
    label: "Default",
    description: "The standard HCE Cleaning look — bright, teal-accented, soft corners.",
    swatches: ["#f6f8fb", "#0d9488", "#0f172a"],
  },
  {
    id: "victorian",
    label: "Victorian Industrial",
    description: "Engraved typography, squared boxes and hairline ornament over the standard palette.",
    swatches: ["#f6f8fb", "#0d9488", "#0f172a"],
  },
] as const

export type ThemeId = (typeof THEMES)[number]["id"]
export const THEME_COOKIE = "cln-theme"
export const DEFAULT_THEME: ThemeId = "default"

/** Narrow an untrusted cookie value to a known theme id. */
export function normalizeTheme(value: string | undefined | null): ThemeId {
  return THEMES.some((t) => t.id === value) ? (value as ThemeId) : DEFAULT_THEME
}
