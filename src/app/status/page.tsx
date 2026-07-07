import { CheckCircle2, Activity } from "lucide-react"
import Link from "next/link"
import { RelayWordmarkWhite } from "@/components/logo"

const COMPONENTS = [
  { name: "Application",  description: "Web app and API endpoints" },
  { name: "Database",     description: "Data storage and retrieval" },
  { name: "Email",        description: "Notifications and transactional email" },
  { name: "Payments",     description: "Billing and subscription management" },
  { name: "AI Features",  description: "Intelligence modules and suggestions" },
]

export default function StatusPage() {
  const checkedAt = new Date().toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  })

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <Link href="/">
          <RelayWordmarkWhite height={26} />
        </Link>
        <span className="text-gray-600 text-sm">/ Status</span>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12">
        {/* Overall status */}
        <div className="flex items-center gap-3 bg-green-900/30 border border-green-800 rounded-2xl px-6 py-5 mb-8">
          <div className="w-10 h-10 bg-green-900/60 rounded-full flex items-center justify-center flex-shrink-0">
            <Activity className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-lg">All Systems Operational</p>
            <p className="text-green-400 text-sm mt-0.5">No incidents reported</p>
          </div>
        </div>

        {/* Component list */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-white font-semibold">System Components</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {COMPONENTS.map(({ name, description }) => (
              <div key={name} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-white text-sm font-medium">{name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{description}</p>
                </div>
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Operational</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mb-4">
          Last checked: {checkedAt}
        </p>

        <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-4 text-center">
          <p className="text-gray-400 text-sm">
            For real-time updates follow{" "}
            <a
              href="https://twitter.com/getrelay"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              @getrelay
            </a>{" "}
            on status updates or email{" "}
            <a
              href="mailto:info@getrelay.software"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              info@getrelay.software
            </a>
            .
          </p>
        </div>
      </main>

      <footer className="border-t border-gray-800 px-6 py-4 text-center">
        <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
          <Link href="/" className="hover:text-gray-400 transition-colors">← Back to Relay</Link>
          <span>·</span>
          <span>Status · Relay</span>
        </div>
      </footer>
    </div>
  )
}
