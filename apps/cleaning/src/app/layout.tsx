import type { Metadata, Viewport } from "next"
import { cookies } from "next/headers"
import { Playfair_Display } from "next/font/google"
import { THEME_COOKIE, normalizeTheme } from "@/lib/theme"
import "./globals.css"

// Victorian-theme display face (titles/headings only). preload:false means the
// files are fetched only when an element actually uses the family — i.e. only for
// users on the Victorian theme. Default-theme users download zero extra font
// bytes, and the Victorian body/tables/forms keep the app's system sans (fast,
// highly legible), so the only added web font is this one display face:
// Playfair Display, a high-contrast Victorian Didone, at a single weight.
const playfair = Playfair_Display({
  weight: ["700"],
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  preload: false,
})

export const metadata: Metadata = {
  title: "HCE Cleaning",
  description: "Cleaning ERP & Field Service",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-user theme from a cookie, applied server-side so there's no flash.
  const theme = normalizeTheme((await cookies()).get(THEME_COOKIE)?.value)
  return (
    <html lang="en" data-theme={theme} className={playfair.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
