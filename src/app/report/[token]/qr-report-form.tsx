"use client"

import { useState } from "react"
import { MapPin, Building2, Camera, User, Mail, Phone, ChevronRight } from "lucide-react"

interface QrCodeData {
  id: string
  token: string
  name: string
  description: string | null
  reportingMode: string
  area: string | null
  defaultCategory: string
  allowedCategories: string[]
  collectContactInfo: boolean
  requireContactInfo: boolean
  requirePhoto: boolean
  location: { id: string; name: string } | null
  department: { id: string; name: string } | null
  asset: { id: string; name: string } | null
  organization: { id: string; name: string }
}

const MODE_PLACEHOLDERS: Record<string, string> = {
  PUBLIC_ISSUE: "Describe the issue you're reporting…",
  EMPLOYEE_REPORTING: "Describe what you observed…",
  ASSET_REPORTING: "Describe the asset issue…",
  VISITOR_FEEDBACK: "Share your feedback…",
  SAFETY_REPORTING: "Describe the safety concern…",
}

const MODE_TITLE_PLACEHOLDERS: Record<string, string> = {
  PUBLIC_ISSUE: "Brief title for this issue",
  EMPLOYEE_REPORTING: "Brief summary",
  ASSET_REPORTING: "Asset issue summary",
  VISITOR_FEEDBACK: "Visitor Feedback",
  SAFETY_REPORTING: "Safety concern summary",
}

export function QrReportForm({ qrCode }: { qrCode: QrCodeData }) {
  const isVisitorFeedback = qrCode.reportingMode === "VISITOR_FEEDBACK"

  const [title, setTitle] = useState(isVisitorFeedback ? "Visitor Feedback" : "")
  const [description, setDescription] = useState("")
  const [reporterName, setReporterName] = useState("")
  const [reporterEmail, setReporterEmail] = useState("")
  const [reporterPhone, setReporterPhone] = useState("")
  const [photo, setPhoto] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [referenceNumber, setReferenceNumber] = useState("")

  const locationStr = [qrCode.location?.name, qrCode.area].filter(Boolean).join(" · ")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!title.trim()) { setError("Title is required"); return }
    if (!description.trim()) { setError("Description is required"); return }
    if (qrCode.requireContactInfo) {
      if (!reporterName.trim()) { setError("Your name is required"); return }
      if (!reporterEmail.trim()) { setError("Your email is required"); return }
    }
    if (qrCode.requirePhoto && !photo) { setError("A photo is required"); return }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append("title", title.trim())
      formData.append("description", description.trim())
      if (reporterName.trim()) formData.append("reporterName", reporterName.trim())
      if (reporterEmail.trim()) formData.append("reporterEmail", reporterEmail.trim())
      if (reporterPhone.trim()) formData.append("reporterPhone", reporterPhone.trim())
      if (photo) formData.append("photo", photo)

      const res = await fetch(`/api/report/${qrCode.token}`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const j = await res.json() as { error?: string }
        setError(j.error ?? "Something went wrong. Please try again.")
        return
      }

      const j = await res.json() as { referenceNumber?: string }
      setReferenceNumber(j.referenceNumber ?? "")
      setSubmitted(true)
    } catch {
      setError("Network error. Please check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Thank you!</h1>
          <p className="text-gray-600 mb-1">Your report has been received.</p>
          <p className="text-sm text-gray-400 mb-3">{qrCode.organization.name} has been notified and will follow up as needed.</p>
          {referenceNumber && (
            <p className="text-xs text-gray-400 font-mono bg-gray-100 rounded-lg px-3 py-2 inline-block">
              Reference: {referenceNumber}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">{qrCode.organization.name}</p>
          <h1 className="text-xl font-bold text-gray-900">{qrCode.name}</h1>
          {locationStr && (
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5" /> {locationStr}
            </p>
          )}
          {qrCode.department && (
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
              <Building2 className="w-3.5 h-3.5" /> {qrCode.department.name}
            </p>
          )}
          {qrCode.description && (
            <p className="text-sm text-gray-400 mt-2">{qrCode.description}</p>
          )}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            readOnly={isVisitorFeedback}
            placeholder={MODE_TITLE_PLACEHOLDERS[qrCode.reportingMode] ?? "Brief title"}
            className={`w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isVisitorFeedback ? "bg-gray-50 text-gray-500" : "bg-white"}`}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={5}
            placeholder={MODE_PLACEHOLDERS[qrCode.reportingMode] ?? "Describe what you're reporting…"}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* Contact Info */}
        {qrCode.collectContactInfo && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">
              Contact Information
              {!qrCode.requireContactInfo && <span className="text-gray-400 font-normal ml-1">(optional)</span>}
            </p>

            <div>
              <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                <User className="w-3 h-3" /> Name
                {qrCode.requireContactInfo && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <input
                value={reporterName}
                onChange={e => setReporterName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                <Mail className="w-3 h-3" /> Email
                {qrCode.requireContactInfo && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <input
                type="email"
                value={reporterEmail}
                onChange={e => setReporterEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3" /> Phone <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="tel"
                value={reporterPhone}
                onChange={e => setReporterPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Photo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
            <Camera className="w-4 h-4" />
            Photo
            {qrCode.requirePhoto
              ? <span className="text-red-500">*</span>
              : <span className="text-gray-400 font-normal">(optional)</span>
            }
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center bg-white hover:border-indigo-400 transition-colors cursor-pointer relative">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={e => {
                const file = e.target.files?.[0] ?? null
                setPhoto(file)
                if (file && error) setError("")
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {photo ? (
              <div>
                <p className="text-sm font-medium text-gray-700">{photo.name}</p>
                <p className="text-xs text-gray-400 mt-1">{(photo.size / 1024).toFixed(0)} KB · Tap to change</p>
              </div>
            ) : (
              <div>
                <Camera className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Tap to take a photo or upload</p>
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          {submitting ? "Submitting…" : "Submit Report"}
          {!submitting && <ChevronRight className="w-4 h-4" />}
        </button>

        <p className="text-xs text-gray-400 text-center pb-6">
          Your report will be received by {qrCode.organization.name}.
        </p>
      </form>
    </div>
  )
}
