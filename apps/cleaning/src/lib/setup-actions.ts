"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

// Dismissal of the first-run setup guide is stored in a cookie rather than the
// DB: it is a per-viewer UI preference, needs no migration, and the guide also
// auto-hides once all steps are complete (that part is derived from real data).
const COOKIE = "cln_setup_dismissed"

export async function isSetupGuideDismissed(): Promise<boolean> {
  const store = await cookies()
  return store.get(COOKIE)?.value === "1"
}

export async function dismissSetupGuide() {
  const store = await cookies()
  store.set(COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
  revalidatePath("/dashboard")
  revalidatePath("/settings")
}

export async function restoreSetupGuide() {
  const store = await cookies()
  store.delete(COOKIE)
  revalidatePath("/dashboard")
  revalidatePath("/settings")
}
