"use client"

import { useState } from "react"
import { Copy, Check, ExternalLink, Key, Webhook, FileUp, Link2, ClipboardList } from "lucide-react"

type Tab = "links" | "surveys" | "webhook" | "import" | "integrations"

interface Location { id: string; name: string; slug: string }
interface ApiKey   { id: string; name: string; keyPrefix: string; createdAt: string }

interface Props {
  orgSlug:   string
  orgName:   string
  locations: Location[]
  apiKeys:   ApiKey[]
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
    </button>
  )
}

function UrlRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
      <span className="text-xs font-medium text-gray-500 w-28 shrink-0">{label}</span>
      <code className="flex-1 text-xs text-gray-800 truncate">{url}</code>
      <CopyButton text={url} />
      <a href={url} target="_blank" rel="noreferrer" className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700">
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  )
}

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: "links",        label: "Feedback Links", icon: <Link2 className="w-4 h-4" /> },
  { id: "surveys",      label: "Surveys",        icon: <ClipboardList className="w-4 h-4" /> },
  { id: "webhook",      label: "Webhook",        icon: <Webhook className="w-4 h-4" /> },
  { id: "import",       label: "CSV Import",     icon: <FileUp className="w-4 h-4" /> },
  { id: "integrations", label: "API Keys",       icon: <Key className="w-4 h-4" /> },
]

export function CustomerVoiceSettings({ orgSlug, orgName, locations, apiKeys }: Props) {
  const [tab, setTab] = useState<Tab>("links")
  const base = typeof window !== "undefined" ? window.location.origin : ""

  const orgFeedbackUrl = `${base}/feedback/${orgSlug}`

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Customer Voice Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-8 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Feedback Links */}
      {tab === "links" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Organization Feedback Page</h2>
            <p className="text-xs text-gray-500 mb-3">Share this link with customers to collect feedback for your whole organization.</p>
            <UrlRow label={orgName} url={orgFeedbackUrl} />
          </div>

          {locations.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Location Feedback Pages</h2>
              <p className="text-xs text-gray-500 mb-3">Location-specific URLs auto-tag feedback to that location.</p>
              <div className="space-y-2">
                {locations.map(loc => (
                  loc.slug ? (
                    <UrlRow key={loc.id} label={loc.name} url={`${base}/feedback/${orgSlug}/${loc.slug}`} />
                  ) : (
                    <div key={loc.id} className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                      <span className="text-xs text-gray-500 w-28 shrink-0">{loc.name}</span>
                      <span className="text-xs text-gray-400 italic">No slug — edit this location to add one</span>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-semibold mb-1">Print QR codes</p>
            <p className="text-xs">Use any free QR code generator (e.g. qr-code-generator.com) with the URL above to create printable codes for your location.</p>
          </div>
        </div>
      )}

      {/* Surveys */}
      {tab === "surveys" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Customer surveys let you collect structured feedback via a shareable link. Each survey generates a unique URL that you can share via email, SMS, or QR code.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-sm text-gray-700">
            <p className="font-semibold">Survey URL format:</p>
            <code className="text-xs text-gray-600 block">{base}/survey/{"<survey-token>"}</code>
          </div>
          <a
            href="/customer-voice/surveys/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Create New Survey
          </a>
        </div>
      )}

      {/* Webhook */}
      {tab === "webhook" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Webhook Endpoint</h2>
            <UrlRow label="POST" url={`${base}/api/webhooks/customer-feedback`} />
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">Authentication</h2>
            <p className="text-xs text-gray-500">Pass your API key in the Authorization header:</p>
            <pre className="bg-gray-900 text-gray-100 text-xs rounded-xl p-4 overflow-x-auto">{`Authorization: Bearer YOUR_API_KEY`}</pre>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">Request Body</h2>
            <pre className="bg-gray-900 text-gray-100 text-xs rounded-xl p-4 overflow-x-auto">{JSON.stringify({
              rating: 4,
              feedbackText: "Great service!",
              customerName: "Jane Smith",
              customerEmail: "jane@example.com",
              locationIdentifier: "downtown",
              submittedAt: "2024-01-15T10:30:00Z",
              externalId: "review-12345",
              source: "Google",
              metadata: { platform: "google_maps" },
            }, null, 2)}</pre>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600 space-y-1">
            <p><span className="font-semibold">rating</span> — 1–5 or 0–10 NPS (auto-normalized)</p>
            <p><span className="font-semibold">locationIdentifier</span> — location id, name, or slug</p>
            <p><span className="font-semibold">externalId</span> — used for deduplication; safe to re-send</p>
            <p><span className="font-semibold">source</span> — label shown in the inbox (default: "WEBHOOK")</p>
          </div>

          {apiKeys.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
              You don&apos;t have any active API keys yet.{" "}
              <a href="/settings/api-keys" className="underline">Create one in Settings.</a>
            </div>
          )}
        </div>
      )}

      {/* Import */}
      {tab === "import" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Import historical feedback from a CSV file. Each row becomes a CustomerFeedback record with AI classification applied.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600 space-y-1">
            <p className="font-semibold text-gray-700 text-sm mb-2">Supported columns</p>
            <p><span className="font-semibold">rating</span> — numeric 1–5</p>
            <p><span className="font-semibold">feedbackText</span> — the customer&apos;s comment</p>
            <p><span className="font-semibold">customerName</span> — optional</p>
            <p><span className="font-semibold">customerEmail</span> — optional</p>
            <p><span className="font-semibold">locationName</span> — matched to your locations by name or slug</p>
            <p><span className="font-semibold">submittedAt</span> — ISO 8601 or any parseable date string</p>
          </div>
          <a
            href="/customer-voice/import"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <FileUp className="w-4 h-4" />
            Go to Import
          </a>
        </div>
      )}

      {/* API Keys */}
      {tab === "integrations" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">API keys are used to authenticate webhook requests and direct API integrations.</p>
          {apiKeys.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
              <Key className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No active API keys</p>
              <a href="/settings/api-keys" className="mt-2 inline-block text-sm text-blue-600 hover:underline">Create an API key →</a>
            </div>
          ) : (
            <div className="space-y-2">
              {apiKeys.map(k => (
                <div key={k.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{k.name}</p>
                    <p className="text-xs text-gray-400">{k.keyPrefix}•••• · Created {new Date(k.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
              <a href="/settings/api-keys" className="text-sm text-blue-600 hover:underline block">Manage API keys →</a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
