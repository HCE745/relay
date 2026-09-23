"use client"

import { useState } from "react"
import Link from "next/link"

export default function AccountDeletePage() {
  const [email,     setEmail]     = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [done,      setDone]      = useState(false)
  const [error,     setError]     = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/account/delete-request", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      })
      const d = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        setError(d.error ?? "Something went wrong. Please try again.")
        return
      }
      setDone(true)
    } catch {
      setError("Network error. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "480px" }}>

        {/* Logo / App name */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "48px", height: "48px", borderRadius: "12px", background: "#1d4ed8", marginBottom: "12px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" strokeWidth="0" />
            </svg>
          </div>
          <p style={{ margin: 0, fontSize: "13px", color: "#6b7280", fontWeight: 500 }}>Relay</p>
        </div>

        {done ? (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "40px 32px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 700, color: "#111827" }}>Request Received</h1>
            <p style={{ margin: "0 0 6px", fontSize: "15px", color: "#374151", lineHeight: 1.6 }}>
              Your account deletion request has been received and will be processed within <strong>90 days</strong>.
            </p>
            <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#6b7280" }}>
              Submitted for: <strong style={{ color: "#374151" }}>{email}</strong>
            </p>
            <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
              If you have questions, contact{" "}
              <a href="mailto:support@getrelay.software" style={{ color: "#1d4ed8" }}>support@getrelay.software</a>
            </p>
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "40px 32px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <h1 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 700, color: "#111827" }}>Request Account Deletion</h1>
            <p style={{ margin: "0 0 28px", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
              To delete your Relay account and all associated data, enter the email address linked to your account below.
              Your data will be permanently deleted within 90 days.{" "}
              <Link href="/account/delete-confirmation" style={{ color: "#1d4ed8", textDecoration: "none" }}>
                Learn what gets deleted →
              </Link>
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 14px",
                    fontSize: "15px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    outline: "none",
                    color: "#111827",
                    background: "#fff",
                  }}
                />
              </div>

              <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "24px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                  required
                  style={{ marginTop: "2px", width: "16px", height: "16px", flexShrink: 0, accentColor: "#1d4ed8", cursor: "pointer" }}
                />
                <span style={{ fontSize: "14px", color: "#374151", lineHeight: 1.5 }}>
                  I understand that my account and all associated data — including issues, assets, team members, photos, and all organization data — will be <strong>permanently deleted</strong> and cannot be recovered.
                </span>
              </label>

              {error && (
                <div style={{ marginBottom: "16px", padding: "12px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "14px", color: "#dc2626" }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!confirmed || loading}
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#fff",
                  background: confirmed && !loading ? "#dc2626" : "#d1d5db",
                  border: "none",
                  borderRadius: "8px",
                  cursor: confirmed && !loading ? "pointer" : "not-allowed",
                  transition: "background 0.15s",
                }}
              >
                {loading ? "Submitting…" : "Submit Deletion Request"}
              </button>
            </form>

            <p style={{ margin: "20px 0 0", fontSize: "12px", color: "#9ca3af", textAlign: "center", lineHeight: 1.5 }}>
              This request is processed by the Relay team within 90 days.
              Questions? Email{" "}
              <a href="mailto:support@getrelay.software" style={{ color: "#1d4ed8", textDecoration: "none" }}>support@getrelay.software</a>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
