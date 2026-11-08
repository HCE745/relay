// Pure helpers extracted from registration-crm-sync.ts — no server-only guard,
// no DB calls. Safe for both server and test contexts.

export const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.co.uk", "yahoo.ca", "yahoo.com.au",
  "hotmail.com", "hotmail.co.uk", "hotmail.ca",
  "outlook.com", "outlook.co.uk",
  "live.com", "live.co.uk",
  "msn.com", "aol.com",
  "icloud.com", "me.com", "mac.com",
  "protonmail.com", "proton.me",
  "tutanota.com",
  "zoho.com",
  "yandex.com", "yandex.ru",
  "mail.com", "email.com",
  "inbox.com", "rediffmail.com",
])

export function extractEmailDomain(email: string): string | null {
  const parts = email.toLowerCase().trim().split("@")
  return parts.length === 2 ? parts[1] : null
}

export function isPublicEmailDomain(domain: string | null): boolean {
  if (!domain) return true
  return PUBLIC_EMAIL_DOMAINS.has(domain.toLowerCase())
}

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"]/g, " ")
    .replace(/\b(inc|llc|corp|ltd|co|company|incorporated|limited|llp|lp|plc|gmbh|ag)\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export type OnboardingStatus = "not_started" | "in_progress" | "completed" | "stalled"
