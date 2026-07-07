import type { Metadata, Viewport } from "next"
import { Geist, Manrope } from "next/font/google"
import { Toaster } from "sonner"
import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const manrope = Manrope({ subsets: ["latin"], weight: ["700"], variable: "--font-manrope" })

export const metadata: Metadata = {
  title: "Relay — Operational Workflow Platform",
  description: "Report, route, track, escalate, and resolve operational issues",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Relay",
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [{ color: "#111827" }],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${manrope.variable} h-full`}>
      <head>
        {/* Register service worker for offline support */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))`,
          }}
        />
      </head>
      <body className="h-full bg-gray-50 font-sans antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "font-sans text-sm",
            },
          }}
        />
      </body>
    </html>
  )
}
