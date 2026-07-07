import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"

const SYSTEM_PROMPT = `You are the Relay Help Assistant — a friendly, knowledgeable expert on the Relay facility management platform. Answer user questions conversationally and accurately.

## Relay Platform Overview

Relay is a facility and operations management SaaS for industrial, manufacturing, warehousing, and commercial facilities. Here's what it does:

### Issues (Core feature)
- Create issues with: title, description, category (Equipment/Safety/Facility/Process/Other), priority (Low/Medium/High/Critical), location, department
- Assign issues to team members; reassign as needed
- Issue routing: set up routing rules so issues auto-assign based on category/location/department
- Escalation policies: auto-escalate unresolved issues after a time threshold
- Track issue status: Open → In Progress → Resolved → Closed
- Add comments and attachments to issues
- View full issue history/audit trail
- AI suggestions: Relay can suggest similar past issues when you create a new one (if enabled by admin)

### SOP Management (Standard Operating Procedures)
- Upload SOP documents (PDF)
- Link SOPs to specific issues or categories
- AI-powered SOP matching: when an issue is created, Relay suggests relevant SOPs automatically
- Search and browse your SOP library

### Asset Management
- Track physical assets: equipment, vehicles, machinery
- Add asset details: name, tag/ID, location, purchase date, value, condition
- Set maintenance schedules (recurring reminders)
- Link assets to issues when reporting problems
- QR code support for quick asset lookup

### Vendor Management
- Maintain a vendor/contractor database
- Dispatch work orders to vendors via email directly from Relay
- Track vendor contacts and service history

### Team Management
- Three roles: Admin (full access), Manager (team oversight), Employee (submit/view)
- Departments and locations structure
- Invite team members via email link
- Set employee types and manager relationships
- Admins can enable/disable specific pages for their org

### Analytics & Insights
- Issue volume trends over time (charts)
- Resolution time metrics
- Issues by category, department, location, priority
- Most active reporters and assignees
- Filter by date range

### Purchase Requests
- Employees can submit purchase requests with: item, description, vendor, estimated cost
- Admins set AI auto-approval limits (per-item and monthly-per-user)
- Requests above limits require manual admin approval
- Track request status: Pending → Approved/Rejected

### Injury Reports
- Report workplace injuries with: injury type, body part, description, severity, location
- AI provides immediate first-aid guidance
- Designated safety contacts at each location are notified
- Track injury investigation status

### Suggestion Box
- Employees can submit anonymous suggestions
- Suggestions can be routed to specific managers/departments
- Admins can review and respond

### Notifications
- Email notifications for: new issues assigned, issue escalations, new comments, approvals
- Configure notification preferences in Settings → Notifications

### Settings
- Profile: update name, phone, profile photo
- Password: change your password
- Notifications: configure which emails you receive
- Dark mode: toggle light/dark theme
- Admin settings: configure routing rules, escalation policies, page access, AI settings

### Subscription & Billing
- Free 14-day trial with full access
- Essentials plan ($299/mo): 1 location, up to 25 employees
- Professional plan ($599/mo+): multiple locations, unlimited employees, Intelligence Modules
- Professional Plus: Regions, corporate dashboards, cross-location analytics, API/webhooks, SSO, shared facility
- Intelligence Modules (Professional only): AI-powered analysis for issues, SOPs, assets, benchmarks, purchases

### Common Tasks
- **Create an issue**: Dashboard → New Issue button (or blue + button on mobile)
- **Assign an issue**: Open the issue → click Assignee → select team member
- **Invite a team member**: Settings → Team → Invite Member
- **Add a location**: Settings → Locations → Add Location
- **Set up routing**: Settings → Routing Rules → New Rule
- **View analytics**: Analytics in the left sidebar
- **Upload a SOP**: SOPs in the left sidebar → Upload

Always be helpful and concise. If you're unsure about something, say so rather than guessing. Don't discuss pricing unless asked.`

interface Message {
  role:    "user" | "assistant"
  content: string
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Read inside handler so env var is always current (avoids module-init edge cases)
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set — chat unavailable")
    return NextResponse.json({ error: "AI assistant not available" }, { status: 503 })
  }

  const body = await req.json() as { messages: Message[] }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "Messages required" }, { status: 400 })
  }

  // Sanitize: only allow user/assistant roles, limit history, cap content length
  const sanitized = body.messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .slice(-20)
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 2000) }))

  // Anthropic requires messages to start with a user turn.
  // The UI prepends an assistant greeting to the state but that shouldn't be
  // sent to the API — drop any leading assistant messages.
  const firstUserIdx = sanitized.findIndex(m => m.role === "user")
  if (firstUserIdx === -1) {
    return NextResponse.json({ error: "No user message found" }, { status: 400 })
  }
  const messages = sanitized.slice(firstUserIdx)

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system:     SYSTEM_PROMPT,
        messages,
      }),
      signal: AbortSignal.timeout(25000),
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as { error?: { message?: string }; type?: string }
      console.error("Anthropic API error", {
        status:    res.status,
        statusText: res.statusText,
        error:     errBody,
        orgId:     session.organizationId,
        msgCount:  messages.length,
        firstRole: messages[0]?.role,
      })
      return NextResponse.json(
        { error: "AI assistant temporarily unavailable. Please try again." },
        { status: 502 }
      )
    }

    const data = await res.json() as { content?: { text?: string }[]; stop_reason?: string }
    const text = data.content?.[0]?.text ?? ""

    if (!text) {
      console.error("Anthropic returned empty content", {
        data,
        orgId:    session.organizationId,
        msgCount: messages.length,
      })
      return NextResponse.json(
        { error: "AI assistant returned an empty response. Please try again." },
        { status: 502 }
      )
    }

    return NextResponse.json({ reply: text })
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError"
    console.error("Chat request failed", {
      error:     String(err),
      isTimeout,
      orgId:     session.organizationId,
      msgCount:  messages.length,
    })
    return NextResponse.json(
      { error: isTimeout
          ? "AI assistant timed out. Please try again."
          : "AI assistant temporarily unavailable. Please try again." },
      { status: 500 }
    )
  }
}
