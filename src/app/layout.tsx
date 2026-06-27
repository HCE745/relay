import type { Metadata } from "next"
import { Toaster } from "sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: "HCE Books",
  description: "Internal accounting platform for HCE Holdings",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">
        {children}
        <Toaster position="bottom-right" toastOptions={{ classNames: { toast: "text-sm" } }} />
      </body>
    </html>
  )
}
