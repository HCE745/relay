import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { checkLimit, getIP } from "@/lib/ratelimit"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

export const dynamic = "force-dynamic"

// Standalone limiter: 3 requests per IP per hour for deletion requests
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
    : null
const deletionLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, "1 h"), prefix: "rl", analytics: false })
  : null

const ADMIN_EMAIL = "will@getrelay.software"

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const limited = await checkLimit(deletionLimiter, `delete-req:${ip}`, "Too many requests. Please try again later.")
  if (limited) return limited

  let body: { email?: unknown }
  try {
    body = await req.json() as { email?: unknown }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 })
  }

  // Store the request
  await prisma.accountDeletionRequest.create({
    data: { email, ipAddress: ip },
  })

  // Notify admin
  const timestamp = new Date().toUTCString()
  await sendEmail({
    to:      ADMIN_EMAIL,
    subject: `Account Deletion Request — ${email}`,
    html:    `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 16px;font-size:18px;color:#111827">Account Deletion Request</h2>
        <p style="margin:0 0 8px;font-size:14px;color:#374151">A user has submitted an account deletion request:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr>
            <td style="padding:8px 12px;background:#f3f4f6;font-weight:600;font-size:13px;color:#374151;border-radius:4px 0 0 4px;width:120px">Email</td>
            <td style="padding:8px 12px;font-size:13px;color:#111827">${email}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f3f4f6;font-weight:600;font-size:13px;color:#374151;border-radius:4px 0 0 4px">Submitted</td>
            <td style="padding:8px 12px;font-size:13px;color:#111827">${timestamp}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f3f4f6;font-weight:600;font-size:13px;color:#374151;border-radius:4px 0 0 4px">IP Address</td>
            <td style="padding:8px 12px;font-size:13px;color:#111827">${ip}</td>
          </tr>
        </table>
        <p style="margin:0;font-size:13px;color:#6b7280">
          Per policy, this request must be processed within 90 days.
          Find and delete all data associated with this email address across Relay, Supabase, and Vercel Blob.
        </p>
      </div>
    `,
  }).catch(err => console.error("[delete-request] Failed to send admin email:", err))

  return NextResponse.json({ success: true })
}
