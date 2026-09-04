"use client"

import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react"

export type Theme = "contemporary" | "heritage"

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "contemporary",
  setTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme
  children: ReactNode
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  const setTheme = useCallback(async (next: Theme) => {
    // 1. Instant CSS swap
    document.documentElement.dataset.theme = next
    // 2. Client cookie for next SSR render
    document.cookie = `hce-theme=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    // 3. Update state
    setThemeState(next)
    // 4. Persist to DB
    await fetch("/api/auth/theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    })
  }, [])

  // Sync <html> data-theme if the cookie was set before React hydrated
  useEffect(() => {
    if (document.documentElement.dataset.theme !== theme) {
      document.documentElement.dataset.theme = theme
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
