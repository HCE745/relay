"use client"

import { useEffect } from "react"
import { isNativeApp, getNativePlatform } from "@/lib/capacitor"

/** Requests push permission and registers the device token on first native launch. */
export function PushRegistration() {
  useEffect(() => {
    if (!isNativeApp()) return
    void registerPush()
  }, [])

  return null
}

async function registerPush() {
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications")

    const permResult = await PushNotifications.requestPermissions()
    if (permResult.receive !== "granted") return

    await PushNotifications.register()

    await PushNotifications.addListener("registration", async ({ value: token }) => {
      try {
        await fetch("/api/notifications/register-device", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ token, platform: getNativePlatform() }),
        })
      } catch (err) {
        console.error("[push] Device token registration failed:", err)
      }
    })

    await PushNotifications.addListener("registrationError", err => {
      console.error("[push] Registration error:", err)
    })

    await PushNotifications.addListener("pushNotificationActionPerformed", action => {
      // Navigate to the URL embedded in the notification data payload
      const url = action.notification.data?.url as string | undefined
      if (url && url.startsWith("/")) window.location.href = url
    })
  } catch (err) {
    console.error("[push] Setup failed:", err)
  }
}
