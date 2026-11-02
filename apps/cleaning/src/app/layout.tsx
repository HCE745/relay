import type { Metadata, Viewport } from "next"
import { cookies } from "next/headers"
import { Playfair_Display, Cinzel_Decorative } from "next/font/google"
import { THEME_COOKIE, normalizeTheme } from "@/lib/theme"
import "./globals.css"

// Victorian-theme display faces (ornamental titles/headings only). preload:false
// means the files are fetched only when an element actually uses the family —
// i.e. only for users on the Victorian theme. Default-theme users download zero
// extra font bytes, and the Victorian body/tables/forms keep the app's system
// sans (fast, highly legible), so the only added web fonts are these two display
// faces, each a single weight:
//   • Playfair Display — a high-contrast Victorian Didone for headings.
//   • Cinzel Decorative — engraved inscriptional caps (with flourishes) used for
//     the wordmark and page titles, the "titlepage" lettering of the look.
const playfair = Playfair_Display({
  weight: ["700"],
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  preload: false,
})
const cinzel = Cinzel_Decorative({
  weight: ["700"],
  subsets: ["latin"],
  variable: "--font-cinzel",
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
    <html lang="en" data-theme={theme} className={`${playfair.variable} ${cinzel.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
