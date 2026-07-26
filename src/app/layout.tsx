import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Toaster } from "sonner"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  title: "HCE Books",
  description: "Internal accounting platform for HCE Holdings",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`}>
      <body className="h-full antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "text-sm font-medium shadow-lg",
              success: "!border-green-200 !bg-green-50 !text-green-900",
              error: "!border-red-200 !bg-red-50 !text-red-900",
              warning: "!border-amber-200 !bg-amber-50 !text-amber-900",
            },
          }}
        />
      </body>
    </html>
  )
}
