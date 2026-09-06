import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { landingPathForRole } from "@/lib/rbac"

// Middleware normally redirects "/" first; this is a defensive fallback.
export default async function RootPage() {
  const session = await getSession()
  redirect(session ? landingPathForRole(session.role) : "/login")
}
