import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

const FEEDBACK_EMAIL = process.env.BUG_REPORT_EMAIL ?? "will@getrelay.software"
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"

const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  feature_request:     "Feature Request",
  product_feedback:    "Product Feedback",
  ui_ux_suggestion:    "UI/UX Suggestion",
  integration_request: "Integration Request",
  pricing_feedback:    "Pricing Feedback",
  general_suggestion:  "General Suggestion",
}

const VALID_TYPES = Object.keys(FEEDBACK_TYPE_LABELS)

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    feedbackType: string
    description:  string
    name:         string
    email:        string
  }

  if (!body.feedbackType || !VALID_TYPES.includes(body.feedbackType)) {
    return NextResponse.json({ error: "Invalid feedback type" }, { status: 400 })
  }
  if (!body.description?.trim()) {
    return NextResponse.json({ error: "Feedback is required" }, { status: 400 })
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }
  const emailTrimmed = body.email?.trim() ?? ""
  if (!emailTrimmed || !emailTrimmed.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
  }

  try {
    await prisma.featureRequest.create({
      data: {
        organizationId:  null,
        submittedById:   null,
        submittedByName: body.name.trim(),
        submittedByRole: "Visitor",
        orgName:         "",
        feedbackType:    body.feedbackType,
        description:     body.description.trim(),
        submitterEmail:  emailTrimmed,
        status:          "new",
      },
    })

    const typeLabel = FEEDBACK_TYPE_LABELS[body.feedbackType] ?? body.feedbackType

    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:620px;margin:0 auto;color:#111">
  <div style="background:#4f46e5;padding:20px 24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:18px;color:#fff;font-weight:700">${esc(typeLabel)}</h1>
    <p style="margin:4px 0 0;font-size:13px;color:#c7d2fe">From ${esc(body.name)} — public feedback form</p>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:6px">
      <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Name</p>
      <p style="margin:0;font-size:13px">${esc(body.name)}</p>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:16px">
      <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Email</p>
      <p style="margin:0;font-size:13px"><a href="mailto:${esc(emailTrimmed)}">${esc(emailTrimmed)}</a></p>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:16px">
      <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">${esc(typeLabel)}</p>
      <p style="margin:0;font-size:13px;white-space:pre-wrap">${esc(body.description)}</p>
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#6b7280">
      View all feedback: <a href="${APP_URL}/super-admin/feature-requests">${APP_URL}/super-admin/feature-requests</a>
    </p>
  </div>
</div>`

    const emailResult = await sendEmail({
      to:      FEEDBACK_EMAIL,
      subject: `New ${typeLabel} from ${body.name.trim()}`,
      html,
    })

    if (!emailResult.ok) {
      console.error("Public feedback email failed:", emailResult.error)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Public feedback submission error:", err)
    return NextResponse.json({ error: "Failed to submit. Please try again." }, { status: 500 })
  }
}
