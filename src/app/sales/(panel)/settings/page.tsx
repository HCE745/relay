import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Settings, ExternalLink, Mail, Users, Bell, Layers } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const settingsLinks = [
    {
      label:    "Follow-Up Stages",
      desc:     "Configure your outreach sequence stages and day offsets",
      href:     "/sales/settings/stages",
      icon:     Layers,
      external: false,
    },
    {
      label:    "Email Configuration",
      desc:     "IMAP/SMTP settings, connected inboxes",
      href:     "/super-admin/crm/settings",
      icon:     Mail,
      external: true,
    },
    {
      label:    "CRM Settings",
      desc:     "Lead sources, call statuses, pipeline stages",
      href:     "/super-admin/crm/settings",
      icon:     Users,
      external: true,
    },
    {
      label:    "Notification Preferences",
      desc:     "Digest emails, follow-up reminders",
      href:     "/super-admin/crm/settings",
      icon:     Bell,
      external: true,
    },
  ]

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 text-sm mt-0.5">Sales section configuration</p>
      </div>

      {/* Quick links to CRM settings */}
      <div className="space-y-3 mb-8">
        {settingsLinks.map(link => (
          <Link
            key={link.label}
            href={link.href}
            className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl p-4 hover:bg-gray-800/70 transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
              <link.icon className="w-4.5 h-4.5 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white group-hover:text-emerald-300 transition-colors">{link.label}</p>
              <p className="text-xs text-gray-500">{link.desc}</p>
            </div>
            {link.external && <ExternalLink className="w-4 h-4 text-gray-600 shrink-0" />}
          </Link>
        ))}
      </div>

      {/* CRM link */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <Settings className="w-5 h-5 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-300">Advanced Settings</h2>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Full CRM configuration, email sequences, and advanced settings are managed in the Super Admin panel.
        </p>
        <Link
          href="/super-admin/crm"
          className="inline-flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open Super Admin CRM
        </Link>
      </div>

      {/* Session info */}
      <div className="mt-6 px-1">
        <p className="text-xs text-gray-600">
          Logged in as super admin · Sales section uses your super admin session
        </p>
      </div>
    </div>
  )
}
