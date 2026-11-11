import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

export const dynamic = "force-dynamic"

// ── CSV template ─────────────────────────────────────────────────────────────

const TEMPLATE_HEADER = "name,email,role,employee_type_name,location_name,department_name"
const TEMPLATE_EXAMPLE = `Alex Johnson,alex@example.com,EMPLOYEE,Field Technician,Main Plant,Maintenance
Jordan Smith,jordan@example.com,MANAGER,Shift Supervisor,Warehouse A,Operations`

// GET /api/onboarding/import/employees
// Returns a downloadable CSV template.
export function GET() {
  const csv = `${TEMPLATE_HEADER}\n${TEMPLATE_EXAMPLE}\n`
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="employees-import-template.csv"',
    },
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function inviteHtml(orgName: string, inviteUrl: string, inviteeName: string): string {
  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
  <div style="margin-bottom:24px">
    <span style="font-weight:700;font-size:20px;color:#2563eb">Relay</span>
  </div>
  <h2 style="margin:0 0 8px;font-size:18px">You've been invited to join ${orgName}</h2>
  <p style="color:#555;margin:0 0 24px">
    Hi ${inviteeName}, click below to set up your account. This link expires in 72 hours.
  </p>
  <a href="${inviteUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600">Accept Invitation →</a>
</div>`.trim()
}

const VALID_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "HR", "EMPLOYEE"])

// ── POST ──────────────────────────────────────────────────────────────────────

// POST /api/onboarding/import/employees
// Accepts: Content-Type: text/plain or text/csv (raw CSV body)
// Query param: ?confirm=true  → create invitations and send emails
//              (omitted)      → preview mode: validate and return rows, no writes
//
// Required columns: name, email
// Optional columns: role, employee_type_name, location_name, department_name
//
// Returns:
//   preview mode: { rows: PreviewRow[], errors: string[] }
//   confirm mode: { invited: number, errors: string[] }
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can import employees" }, { status: 403 })
  }

  const confirm = request.nextUrl.searchParams.get("confirm") === "true"

  const text = await request.text()
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) {
    return NextResponse.json(
      { error: "CSV must have a header row and at least one data row" },
      { status: 400 },
    )
  }

  const rawHeaders = lines[0].split(",").map(h =>
    h.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z_]/g, ""),
  )
  const col = (name: string) => rawHeaders.indexOf(name)

  if (col("name") === -1 || col("email") === -1) {
    return NextResponse.json(
      { error: 'CSV must include "name" and "email" columns' },
      { status: 400 },
    )
  }

  const orgId = session.organizationId
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  const [org, employeeTypes, locations, departments] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
    prisma.employeeType.findMany({ where: { organizationId: orgId }, select: { id: true, name: true, baseRole: true } }),
    prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
    prisma.department.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
  ])

  const etByName  = new Map(employeeTypes.map(e => [e.name.toLowerCase(), e]))
  const locByName = new Map(locations.map(l => [l.name.toLowerCase(), l]))
  const deptByName = new Map(departments.map(d => [d.name.toLowerCase(), d]))

  const rows = lines.slice(1)
  const errors: string[] = []

  type PreviewRow = {
    rowNum: number
    name: string
    email: string
    role: string
    employeeTypeName: string | null
    locationName: string | null
    departmentName: string | null
    warnings: string[]
  }

  const validRows: PreviewRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2
    const parts = parseCsvLine(rows[i])
    const name  = parts[col("name")]?.trim()
    const email = parts[col("email")]?.trim().toLowerCase()

    if (!name) {
      errors.push(`Row ${rowNum}: name is required`)
      continue
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Row ${rowNum}: invalid email "${email ?? ""}"`)
      continue
    }

    const rawRole    = parts[col("role")]?.trim()
    const rawEtName  = col("employee_type_name") >= 0 ? parts[col("employee_type_name")]?.trim() : undefined
    const rawLocName = col("location_name")       >= 0 ? parts[col("location_name")]?.trim()      : undefined
    const rawDeptName = col("department_name")    >= 0 ? parts[col("department_name")]?.trim()     : undefined

    const et   = rawEtName  ? etByName.get(rawEtName.toLowerCase())   : undefined
    const loc  = rawLocName ? locByName.get(rawLocName.toLowerCase())  : undefined
    const dept = rawDeptName ? deptByName.get(rawDeptName.toLowerCase()) : undefined

    const role = et?.baseRole ?? (rawRole && VALID_ROLES.has(rawRole.toUpperCase()) ? rawRole.toUpperCase() : "EMPLOYEE")

    const warnings: string[] = []
    if (rawEtName  && !et)   warnings.push(`Employee type "${rawEtName}" not found — using default role`)
    if (rawLocName && !loc)  warnings.push(`Location "${rawLocName}" not found — skipping location assignment`)
    if (rawDeptName && !dept) warnings.push(`Department "${rawDeptName}" not found — skipping department assignment`)

    validRows.push({
      rowNum, name, email, role,
      employeeTypeName: rawEtName ?? null,
      locationName:     rawLocName ?? null,
      departmentName:   rawDeptName ?? null,
      warnings,
    })
  }

  if (!confirm) {
    // Preview mode: check for existing accounts/pending invitations and annotate rows
    const emails = validRows.map(r => r.email)

    const [existingUsers, existingInvites] = await Promise.all([
      prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true } }),
      prisma.invitation.findMany({ where: { organizationId: orgId, email: { in: emails }, usedAt: null }, select: { email: true } }),
    ])

    const existingEmailSet = new Set([
      ...existingUsers.map(u => u.email),
      ...existingInvites.map(i => i.email),
    ])

    const previewRows = validRows.map(r => ({
      ...r,
      status: existingEmailSet.has(r.email) ? "skip" as const : "invite" as const,
    }))

    return NextResponse.json({ rows: previewRows, errors })
  }

  // Confirm mode: create invitations and send emails
  const pendingEmails: Array<{ to: string; subject: string; html: string }> = []
  let invited = 0

  for (const row of validRows) {
    // Check for existing user or pending invite
    const existingUser = await prisma.user.findUnique({ where: { email: row.email }, select: { id: true } })
    if (existingUser) {
      errors.push(`${row.email} already has an account — skipped`)
      continue
    }

    const existingInv = await prisma.invitation.findFirst({
      where: { organizationId: orgId, email: row.email, usedAt: null },
      select: { id: true },
    })
    if (existingInv) {
      errors.push(`Invitation for ${row.email} already pending — skipped`)
      continue
    }

    const rawLocName  = row.locationName
    const rawDeptName = row.departmentName
    const loc  = rawLocName  ? locByName.get(rawLocName.toLowerCase())   : undefined
    const dept = rawDeptName ? deptByName.get(rawDeptName.toLowerCase()) : undefined

    const token     = randomUUID()
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)

    try {
      await prisma.invitation.create({
        data: {
          organizationId: orgId,
          email:          row.email,
          token,
          role:           row.role,
          departmentId:   dept?.id ?? null,
          locationId:     loc?.id  ?? null,
          invitedById:    session.userId,
          expiresAt,
        },
      })
      invited++
      pendingEmails.push({
        to:      row.email,
        subject: `You've been invited to join ${org?.name ?? "Relay"}`,
        html:    inviteHtml(org?.name ?? "Relay", `${appUrl}/invite/${token}`, row.name),
      })
    } catch {
      errors.push(`Failed to invite ${row.email}`)
    }
  }

  for (const { to, subject, html } of pendingEmails) {
    sendEmail({ to, subject, html }).catch(console.error)
  }

  return NextResponse.json({ invited, errors })
}
