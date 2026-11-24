import "server-only"
import type { SessionPayload } from "./session"

// CleanWare PLATFORM administration — distinct from customer-organization roles.
// Software bug reports / feature requests are CleanWare's internal product data;
// a cleaning company's OWNER must NOT see them. Platform admins are identified by
// an explicit email allowlist (CLEANWARE_PLATFORM_ADMIN_EMAILS, comma-separated),
// never by org role. Demo sessions are never platform admins.
export function platformAdminEmails(): Set<string> {
  const raw = process.env.CLEANWARE_PLATFORM_ADMIN_EMAILS ?? ""
  return new Set(raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean))
}

export function isPlatformAdmin(session: SessionPayload | null | undefined): boolean {
  if (!session || session.isDemo) return false
  const email = session.email?.toLowerCase()
  if (!email) return false
  return platformAdminEmails().has(email)
}
