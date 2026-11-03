import { getRequestConfig } from "next-intl/server"
import { cookies } from "next/headers"

const VALID_LOCALES = ["en", "es", "fr", "de", "pt", "it", "pl", "nl"] as const
type Locale = (typeof VALID_LOCALES)[number]

function isValidLocale(v: string): v is Locale {
  return (VALID_LOCALES as readonly string[]).includes(v)
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const raw = cookieStore.get("locale")?.value ?? "en"
  const locale: Locale = isValidLocale(raw) ? raw : "en"

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default as Record<string, unknown>,
  }
})
