"use client"

import { isNativeApp } from "@/lib/capacitor"

/** Light tap — use on button presses. */
export async function hapticLight(): Promise<void> {
  if (!isNativeApp()) return
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics")
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch { /* bridge not available */ }
}

/** Medium tap — use on successful form submissions. */
export async function hapticMedium(): Promise<void> {
  if (!isNativeApp()) return
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics")
    await Haptics.impact({ style: ImpactStyle.Medium })
  } catch { /* bridge not available */ }
}

/** Error vibration pattern — use on validation failures. */
export async function hapticError(): Promise<void> {
  if (!isNativeApp()) return
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics")
    await Haptics.notification({ type: NotificationType.Error })
  } catch { /* bridge not available */ }
}

/** Success notification vibration — use after important completions. */
export async function hapticSuccess(): Promise<void> {
  if (!isNativeApp()) return
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics")
    await Haptics.notification({ type: NotificationType.Success })
  } catch { /* bridge not available */ }
}
