"use client"

import { isNativeApp } from "@/lib/capacitor"

/**
 * On a native device opens the system camera/library picker via Capacitor and
 * returns a File. Returns null if running in a browser (fall back to a regular
 * <input type="file"> in that case) or if the user cancels.
 */
export async function pickImageNative(): Promise<File | null> {
  if (!isNativeApp()) return null

  try {
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera")
    const photo = await Camera.getPhoto({
      quality:      90,
      allowEditing: false,
      resultType:   CameraResultType.DataUrl,
      source:       CameraSource.Prompt, // user chooses camera or photo library
    })

    if (!photo.dataUrl) return null

    const res  = await fetch(photo.dataUrl)
    const blob = await res.blob()
    const ext  = photo.format ?? "jpeg"
    return new File([blob], `photo.${ext}`, { type: blob.type || `image/${ext}` })
  } catch {
    // User cancelled the picker
    return null
  }
}
