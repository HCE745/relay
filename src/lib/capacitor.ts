"use client"

type CapacitorGlobal = {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
}

function getCapacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
}

/** Returns true when running inside a native Capacitor app on a real device. */
export function isNativeApp(): boolean {
  return getCapacitor()?.isNativePlatform?.() === true
}

/** Returns the current platform: "android", "ios", or "web". */
export function getNativePlatform(): "android" | "ios" | "web" {
  const platform = getCapacitor()?.getPlatform?.()
  if (platform === "android") return "android"
  if (platform === "ios") return "ios"
  return "web"
}
