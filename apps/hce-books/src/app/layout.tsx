import type { Metadata } from "next"
import { Inter, IBM_Plex_Serif, IBM_Plex_Mono } from "next/font/google"
import { cookies } from "next/headers"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/providers/ThemeProvider"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const ibmPlexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-serif",
  display: "swap",
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "HCE Books",
  description: "Internal accounting platform for HCE Holdings",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const theme = (cookieStore.get("hce-theme")?.value ?? "contemporary") as "contemporary" | "heritage"

  const fontVars = `${inter.variable} ${ibmPlexSerif.variable} ${ibmPlexMono.variable}`

  return (
    <html lang="en" className={`h-full ${fontVars}`} data-theme={theme}>
      <body className="h-full antialiased">
        <ThemeProvider initialTheme={theme}>
          {children}
        </ThemeProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "text-sm font-medium shadow-lg",
              success: "!border-green-200 !bg-green-50 !text-green-900",
              error:   "!border-red-200 !bg-red-50 !text-red-900",
              warning: "!border-amber-200 !bg-amber-50 !text-amber-900",
            },
          }}
        />
      </body>
    </html>
  )
}
