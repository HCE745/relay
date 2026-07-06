import "server-only"
import { NextResponse } from "next/server"
import type { SessionPayload } from "./session"

// ─── Role hierarchy ────────────────────────────────────────────────────────

export type Action =
  | "read"       // view any data in their accessible entities
  | "write"      // create / edit records (Bookkeeper can only create DRAFT)
  | "post"       // finalise / post / send / pay / void — full commit actions
  | "manageSettings" // entity settings, COA, periods
  | "manageUsers"    // invite / edit / deactivate users

// Matrix: role → set of allowed actions
const ROLE_PERMISSIONS: Record<string, Set<Action>> = {
  OWNER:       new Set(["read", "write", "post", "manageSettings", "manageUsers"]),
  ADMIN:       new Set(["read", "write", "post", "manageSettings", "manageUsers"]),
  ACCOUNTANT:  new Set(["read", "write", "post"]),
  BOOKKEEPER:  new Set(["read", "write"]),
  VIEWER:      new Set(["read"]),
}

export function roleCanDo(role: string, action: Action): boolean {
  return ROLE_PERMISSIONS[role]?.has(action) ?? false
}

// ─── Server-side guard helpers ─────────────────────────────────────────────
// Each returns a 403 NextResponse if the check fails, null if it passes.
// Usage: const deny = assertEntityAccess(session, entityId); if (deny) return deny;

/** Confirm the user has any access to entityId. */
export function assertEntityAccess(
  session: SessionPayload,
  entityId: string | null | undefined
): NextResponse | null {
  if (!entityId) {
    return NextResponse.json({ error: "entityId required" }, { status: 400 })
  }
  if (!session.entityIds.includes(entityId)) {
    return NextResponse.json({ error: "Access denied to this entity" }, { status: 403 })
  }
  return null
}

/** Confirm the user's role permits the given action. */
export function assertCan(
  session: SessionPayload,
  action: Action
): NextResponse | null {
  if (!roleCanDo(session.role, action)) {
    return NextResponse.json(
      { error: `Role ${session.role} cannot perform action: ${action}` },
      { status: 403 }
    )
  }
  return null
}

/**
 * Combined guard: entity access + role action check.
 * Most API routes call this once and early-return the denial if non-null.
 */
export function assertAccess(
  session: SessionPayload,
  entityId: string | null | undefined,
  action: Action
): NextResponse | null {
  return assertEntityAccess(session, entityId) ?? assertCan(session, action)
}

/**
 * For consolidated reports: user must have access to every entity in the tenant.
 * We encode this as "has more than one entityId in session" — the login sets
 * entityIds to ALL tenant entities for OWNER, and to user-specific entities
 * for everyone else. The caller can further check against the total entity count.
 */
export function assertConsolidatedAccess(
  session: SessionPayload,
  allTenantEntityIds: string[]
): NextResponse | null {
  const missing = allTenantEntityIds.filter((id) => !session.entityIds.includes(id))
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "Consolidated view requires access to all entities" },
      { status: 403 }
    )
  }
  return null
}

// ─── Boolean helpers for UI-layer gating ──────────────────────────────────
// (These are NOT security boundaries — use assert* functions for API enforcement)

export function canRead(role: string)          { return roleCanDo(role, "read") }
export function canWrite(role: string)         { return roleCanDo(role, "write") }
export function canPost(role: string)          { return roleCanDo(role, "post") }
export function canManageUsers(role: string)   { return roleCanDo(role, "manageUsers") }
export function canManageSettings(role: string){ return roleCanDo(role, "manageSettings") }
