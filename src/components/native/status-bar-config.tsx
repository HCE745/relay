"use client"

import { useEffect } from "react"
import { isNativeApp } from "@/lib/capacitor"

/** Configures the native status bar to match Relay's dark navy header. */
export function StatusBarConfig() {
  useEffect(() => {
    if (!isNativeApp()) return
    void applyStatusBar()
  }, [])

  return null
}

async function applyStatusBar() {
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar")
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: "#0b1f3a" })
  } catch { /* bridge not available */ }
}
