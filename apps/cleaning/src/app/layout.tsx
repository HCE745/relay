import type { Metadata, Viewport } from "next"
import { cookies } from "next/headers"
import { Cormorant_Garamond } from "next/font/google"
import { THEME_COOKIE, normalizeTheme } from "@/lib/theme"
import "./globals.css"

// Victorian-theme display face (ornamental titles only). preload:false means the
// files are fetched only when an element actually uses the family — i.e. only
// for users on the Victorian theme. Default-theme users download zero extra font
// bytes, and the Victorian body text uses the same system sans the app already
// ships (fast and highly legible), so the only added web font is this one serif.
const cormorant = Cormorant_Garamond({
  weight: ["600"],
  subsets: ["latin"],
  variable: "--font-cormorant",
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
    <html lang="en" data-theme={theme} className={cormorant.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
