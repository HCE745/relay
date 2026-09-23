import Link from "next/link"

export const metadata = {
  title: "Data Deletion — Relay",
  description: "What data is deleted when you request account deletion from Relay",
}

const sections = [
  {
    heading: "What data is deleted",
    items: [
      { label: "Account & profile",      detail: "Your name, email address, password, and profile settings." },
      { label: "Organization data",      detail: "Your company name, settings, billing information, and all configuration." },
      { label: "Issues & work orders",   detail: "All reported issues, status history, comments, and resolution records." },
      { label: "Assets & equipment",     detail: "All registered equipment, maintenance records, and asset history." },
      { label: "Team members",           detail: "All user accounts and roles under your organization." },
      { label: "Photos & attachments",   detail: "All uploaded images, videos, and documents attached to issues or assets." },
      { label: "QR codes",               detail: "All QR codes created for reporting and feedback collection." },
      { label: "Customer feedback",      detail: "All feedback records collected through your Relay account." },
      { label: "Analytics & reports",    detail: "Historical analytics, executive briefings, and trend data." },
      { label: "Notifications",          detail: "All in-app and push notification records." },
    ],
  },
  {
    heading: "What is NOT deleted",
    items: [
      { label: "Anonymized aggregate data", detail: "De-identified, aggregate operational patterns used to improve Relay may be retained after your account is deleted." },
      { label: "Legal & compliance records", detail: "Records required by law (e.g. billing receipts) may be retained for the legally required retention period." },
    ],
  },
]

export default function DataDeletionPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: "48px 16px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "40px" }}>
          <Link href="/account/delete" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#6b7280", textDecoration: "none", marginBottom: "24px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Deletion Request
          </Link>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px", borderRadius: "10px", background: "#1d4ed8", marginBottom: "16px" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" />
            </svg>
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: "28px", fontWeight: 800, color: "#111827" }}>
            Data Deletion Policy
          </h1>
          <p style={{ margin: 0, fontSize: "16px", color: "#6b7280", lineHeight: 1.6 }}>
            When you request account deletion, Relay permanently removes all personal and organizational data associated with your account.
            This page explains exactly what is deleted and when.
          </p>
        </div>

        {/* Retention period callout */}
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "12px", padding: "20px 24px", marginBottom: "32px", display: "flex", gap: "16px" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "1px" }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 700, color: "#1e40af" }}>90-Day Retention Period</p>
            <p style={{ margin: 0, fontSize: "14px", color: "#1e40af", lineHeight: 1.5 }}>
              After you submit a deletion request, your data will be fully removed within <strong>90 days</strong>.
              During this period you will not be able to log in or recover your data.
            </p>
          </div>
        </div>

        {/* Data sections */}
        {sections.map(section => (
          <div key={section.heading} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden", marginBottom: "24px" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #f3f4f6" }}>
              <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {section.heading}
              </h2>
            </div>
            <div>
              {section.items.map((item, i) => (
                <div
                  key={item.label}
                  style={{
                    padding: "16px 24px",
                    borderBottom: i < section.items.length - 1 ? "1px solid #f3f4f6" : undefined,
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                  }}
                >
                  {section.heading === "What data is deleted" ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "2px" }}>
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "2px" }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  <div>
                    <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 600, color: "#111827" }}>{item.label}</p>
                    <p style={{ margin: 0, fontSize: "13px", color: "#6b7280", lineHeight: 1.5 }}>{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* How to request */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px", marginBottom: "24px" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 700, color: "#111827" }}>How to Request Deletion</h2>
          <ol style={{ margin: "0 0 20px", paddingLeft: "20px", fontSize: "14px", color: "#374151", lineHeight: 1.8 }}>
            <li>Visit the <Link href="/account/delete" style={{ color: "#1d4ed8", textDecoration: "none" }}>Account Deletion Request page</Link></li>
            <li>Enter the email address associated with your Relay account</li>
            <li>Check the confirmation box and submit the form</li>
            <li>Your request will be processed within 90 days</li>
          </ol>
          <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
            You can also email{" "}
            <a href="mailto:support@getrelay.software" style={{ color: "#1d4ed8", textDecoration: "none" }}>support@getrelay.software</a>
            {" "}to request deletion directly.
          </p>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center" }}>
          <Link
            href="/account/delete"
            style={{
              display: "inline-block",
              padding: "12px 28px",
              fontSize: "15px",
              fontWeight: 600,
              color: "#fff",
              background: "#dc2626",
              borderRadius: "8px",
              textDecoration: "none",
            }}
          >
            Submit a Deletion Request
          </Link>
        </div>

        <p style={{ textAlign: "center", fontSize: "12px", color: "#9ca3af", marginTop: "32px" }}>
          Relay · <a href="https://getrelay.software" style={{ color: "#9ca3af" }}>getrelay.software</a>
        </p>
      </div>
    </div>
  )
}
