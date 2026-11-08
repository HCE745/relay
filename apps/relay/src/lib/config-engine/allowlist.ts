// Phase 1 AI configuration operation allowlist.
// Every AI-proposed configuration change must match one of these operation types.

export const PHASE1_OPERATIONS = [
  "UPDATE_ORG_PROFILE",
  "CREATE_LOCATION",
  "UPDATE_LOCATION",
  "CREATE_DEPARTMENT",
  "UPDATE_DEPARTMENT",
  "CREATE_ROUTING_RULE",
  "EXPLAIN",
] as const

export type OperationType = typeof PHASE1_OPERATIONS[number]

export interface BaseOp {
  type: OperationType
  idempotencyKey: string
}

export interface UpdateOrgProfileOp extends BaseOp {
  type: "UPDATE_ORG_PROFILE"
  name?: string
  industry?: string
  companySize?: string
}

export interface CreateLocationOp extends BaseOp {
  type: "CREATE_LOCATION"
  name: string
  locationType?: string
  address?: string
  city?: string
  state?: string
  country?: string
}

export interface UpdateLocationOp extends BaseOp {
  type: "UPDATE_LOCATION"
  locationId: string
  locationName?: string    // for display; resolver fills locationId
  name?: string
  locationType?: string
  address?: string
  city?: string
  state?: string
}

export interface CreateDepartmentOp extends BaseOp {
  type: "CREATE_DEPARTMENT"
  name: string
  locationRef?: string     // location name — resolver fills locationId
  locationId?: string      // already-resolved location ID
}

export interface UpdateDepartmentOp extends BaseOp {
  type: "UPDATE_DEPARTMENT"
  departmentId: string
  departmentName?: string  // for display
  name?: string
  locationRef?: string
  locationId?: string
}

export interface CreateRoutingRuleOp extends BaseOp {
  type: "CREATE_ROUTING_RULE"
  name: string
  condCategory?: string
  condLocationRef?: string
  condLocationId?: string
  condDeptRef?: string
  condDeptId?: string
  condPriority?: string
  assignToRole?: string
  assignToUserId?: string
}

export interface ExplainOp extends BaseOp {
  type: "EXPLAIN"
  field: string
  context?: string
}

export type ConfigOperation =
  | UpdateOrgProfileOp
  | CreateLocationOp
  | UpdateLocationOp
  | CreateDepartmentOp
  | UpdateDepartmentOp
  | CreateRoutingRuleOp
  | ExplainOp

// Human-readable label per operation type for the preview UI
export function opLabel(type: OperationType): string {
  switch (type) {
    case "UPDATE_ORG_PROFILE": return "Update Organization"
    case "CREATE_LOCATION":    return "New Location"
    case "UPDATE_LOCATION":    return "Update Location"
    case "CREATE_DEPARTMENT":  return "New Department"
    case "UPDATE_DEPARTMENT":  return "Update Department"
    case "CREATE_ROUTING_RULE":return "New Routing Rule"
    case "EXPLAIN":            return "Explanation"
  }
}

export function isAllowedOp(type: string): type is OperationType {
  return (PHASE1_OPERATIONS as readonly string[]).includes(type)
}
