import { redirect } from "next/navigation"
import Link from "next/link"
import { RelayWordmarkWhite } from "@/components/logo"
import { Calendar, Mail } from "lucide-react"

export default function BookDemoPage() {
  const url = process.env.CALENDLY_SCHEDULING_URL
  if (url) redirect(url)

  // Fallback if env var not set
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-8">
          <RelayWordmarkWhite height={40} />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <div className="w-12 h-12 rounded-full bg-indigo-900/40 border border-indigo-800 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-6 h-6 text-indigo-400" />
          </div>
          <h1 className="text-lg font-bold text-white mb-2">Book a Demo</h1>
          <p className="text-gray-400 text-sm mb-6">
            Schedule a personalized walkthrough with our team to see how Relay can work for your organization.
          </p>
          <a
            href="mailto:info@getrelay.software?subject=Demo Request"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            <Mail className="w-4 h-4" />
            Contact Us to Schedule
          </a>
        </div>
        <p className="text-gray-600 text-xs mt-4">
          Or{" "}
          <Link href="/demo" className="text-gray-400 hover:text-white underline">
            try the interactive demo
          </Link>{" "}
          right now.
        </p>
      </div>
    </div>
  )
}
