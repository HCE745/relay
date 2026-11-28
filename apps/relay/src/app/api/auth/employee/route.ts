import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { compare } from "bcryptjs"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { checkLimit, getIP, limiters } from "@/lib/ratelimit"
import { normalizeCredential, computeCredentialIndex } from "@/lib/credential-hmac"
import { createEmployeeSession } from "@/lib/employee-session"
import type { AuthPolicyConfig } from "@/lib/employee-session"

export const dynamic = "force-dynamic"

// POST /api/auth/employee
//
// Quick-access login: employee submits a single credential (Employee ID, custom
// access code, or badge value). Relay identifies the account from the HMAC index
// and verifies the credential. No employee selection step.
//
// Body: { credential: string, organizationSlug?: string }
// Org is resolved from the registered-device cookie when present; otherwise
// organizationSlug is required.
export async function POST(request: NextRequest) {
  const blocked = await checkLimit(
    limiters.employeeLogin,
    `emp-login:${getIP(request)}`,
    "Too many login attempts. Please try again later.",
  )
  if (blocked) return blocked

  const body = await request.json() as { credential?: string; organizationSlug?: string }
  const rawCredential = body.credential?.trim()
  if (!rawCredential) {
    return NextResponse.json({ error: "Credential is required" }, { status: 400 })
  }

  // ── Resolve organization ──────────────────────────────────────────────────
  const cookieStore = await cookies()
  const deviceToken = cookieStore.get("relay-device")?.value ?? null

  let orgId:  string
  let device: Awaited<ReturnType<typeof prisma.registeredDevice.findUnique>> | null = null

  if (deviceToken) {
    const normalized  = normalizeCredential(deviceToken)
    const tokenIndex  = computeCredentialIndex(normalized)
    device = await prisma.registeredDevice.findUnique({
      where: { deviceTokenIndex: tokenIndex },
    })
    if (!device || !device.isActive) {
      // Stale or revoked device cookie — treat as unregistered
      device = null
    }
    if (!device && !body.organizationSlug) {
      return NextResponse.json({ error: "Organization is required" }, { status: 400 })
    }
  }

  if (device) {
    orgId = device.organizationId
    // Update lastSeenAt
    void prisma.registeredDevice.update({
      where: { id: device.id },
      data:  { lastSeenAt: new Date() },
    }).catch(() => undefined)
  } else {
    if (!body.organizationSlug) {
      return NextResponse.json({ error: "Organization is required" }, { status: 400 })
    }
    const org = await prisma.organization.findUnique({
      where:  { slug: body.organizationSlug },
      select: { id: true, subscriptionStatus: true },
    })
    if (!org || org.subscriptionStatus === "canceled" || org.subscriptionStatus === "expired") {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }
    orgId = org.id
  }

  // ── Credential lookup ─────────────────────────────────────────────────────
  const normalized = normalizeCredential(rawCredential)
  const idx        = computeCredentialIndex(normalized)

  // 1. Try Employee ID (HMAC index lookup on EmployeeCredential)
  const empIdMatch = await prisma.employeeCredential.findFirst({
    where: {
      organizationId:    orgId,
      employeeIdEnabled: true,
      employeeIdIndex:   idx,
    },
    select: { userId: true },
  })

  // 2. Try custom access code (HMAC index + bcrypt verify)
  const accessCodeMatch = empIdMatch ? null : await prisma.employeeCredential.findFirst({
    where: {
      organizationId:   orgId,
      accessCodeEnabled: true,
      accessCodeIndex:  idx,
    },
    select: { userId: true, accessCodeHash: true },
  })

  // 3. Try badge (HMAC index lookup on EmployeeBadge)
  const badgeMatch = (empIdMatch || accessCodeMatch) ? null : await prisma.employeeBadge.findFirst({
    where: {
      organizationId:  orgId,
      credentialIndex: idx,
      isActive:        true,
    },
    select: { userId: true, credentialHash: true },
  })

  if (!empIdMatch && !accessCodeMatch && !badgeMatch) {
    // Avoid leaking which credentials exist — always return same error
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  // ── Verification ──────────────────────────────────────────────────────────
  let userId: string

  if (empIdMatch) {
    // Employee ID: HMAC match is sufficient (ID is not secret; not bcrypt-verified)
    userId = empIdMatch.userId
  } else if (accessCodeMatch) {
    if (!accessCodeMatch.accessCodeHash) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }
    const ok = await compare(rawCredential, accessCodeMatch.accessCodeHash)
    if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    userId = accessCodeMatch.userId
  } else {
    // badgeMatch guaranteed non-null here
    if (badgeMatch!.credentialHash) {
      // Relay-generated badge — bcrypt verify
      const ok = await compare(rawCredential, badgeMatch!.credentialHash)
      if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }
    // Third-party badge: HMAC match is sufficient
    userId = badgeMatch!.userId
  }

  // ── Load user ─────────────────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      id: true, email: true, name: true, role: true,
      organizationId: true, isActive: true, employeeSessionVersion: true,
    },
  })

  if (!user || !user.isActive || user.organizationId !== orgId) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  // ── Load org auth policy ──────────────────────────────────────────────────
  const org = await prisma.organization.findUnique({
    where:  { id: orgId },
    select: { authPolicyConfig: true },
  })
  const orgPolicy = (org?.authPolicyConfig ?? null) as AuthPolicyConfig | null

  // Check permitted methods on device (if registered)
  if (device) {
    const permitted = device.permittedMethods as string[]
    if (permitted.length > 0) {
      const usedMethod = empIdMatch ? "EMPLOYEE_ID" : accessCodeMatch ? "ACCESS_CODE" : "BADGE"
      if (!permitted.includes(usedMethod)) {
        return NextResponse.json({ error: "This authentication method is not permitted on this device" }, { status: 403 })
      }
    }
  }

  // ── Issue session ─────────────────────────────────────────────────────────
  await createEmployeeSession({
    user: {
      id:                     user.id,
      email:                  user.email,
      name:                   user.name,
      role:                   user.role,
      organizationId:         user.organizationId,
      employeeSessionVersion: user.employeeSessionVersion,
    },
    device: device ? {
      id:                       device.id,
      sessionVersion:           device.sessionVersion,
      loginMode:                device.loginMode,
      inactivityTimeoutSeconds:  device.inactivityTimeoutSeconds,
      maxSessionDurationSeconds: device.maxSessionDurationSeconds,
      disableInactivityTimeout:  device.disableInactivityTimeout,
      disableMaxSessionDuration: device.disableMaxSessionDuration,
    } : null,
    orgPolicy,
  })

  return NextResponse.json({ ok: true })
}
