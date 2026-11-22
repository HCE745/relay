/**
 * White-glove onboarding wizard — step definitions.
 * Shared between the API layer and the wizard page component.
 * Not server-only: safe to import from client components.
 */

export type WizardStepKey =
  | "overview"
  | "locations"
  | "departments"
  | "employee-types"
  | "issue-settings"
  | "notifications"
  | "sops"
  | "qr-codes"
  | "feature-flags"
  | "employee-list"
  | "readiness"

export type WizardStep = {
  key:         WizardStepKey
  number:      number
  title:       string
  description: string
  optional:    boolean
}

// A staged employee: prepared for invitation during wizard, NOT yet sent.
// Stored in wizardProgress JSON — no Invitation record is created until launch.
export type StagedEmployee = {
  id:             string   // cuid()-style client ID, never a DB row ID
  name:           string
  email:          string
  role:           string   // baseRole: EMPLOYEE | SUPERVISOR | MANAGER | HR | ADMIN
  employeeTypeId: string | null
  departmentId:   string | null
  locationId:     string | null
  managerId:      string | null
  createdAt:      string
}

export type WizardProgress = {
  currentStepKey:   string | null
  completedSteps:   string[]
  skippedSteps:     string[]
  lastSavedAt:      string | null
  stagedEmployees:  StagedEmployee[]
}

export type StepStatus = "current" | "completed" | "skipped" | "incomplete"

export type WizardStepWithStatus = WizardStep & { status: StepStatus }

export const WIZARD_STEPS: WizardStep[] = [
  {
    key: "overview", number: 1,
    title: "Customer Overview",
    description: "Review org info, contact details, plan, and trial start date.",
    optional: false,
  },
  {
    key: "locations", number: 2,
    title: "Facility Locations",
    description: "Add and configure the customer's physical locations.",
    optional: false,
  },
  {
    key: "departments", number: 3,
    title: "Departments",
    description: "Set up organizational departments and their location assignments.",
    optional: false,
  },
  {
    key: "employee-types", number: 4,
    title: "Employee Types",
    description: "Define employee roles and their permission levels in Relay.",
    optional: false,
  },
  {
    key: "issue-settings", number: 5,
    title: "Issue Settings",
    description: "Configure priority rules, terminology, and category routing.",
    optional: false,
  },
  {
    key: "notifications", number: 6,
    title: "Notifications & Escalations",
    description: "Set up alert rules, escalation paths, and injury reporting.",
    optional: false,
  },
  {
    key: "sops", number: 7,
    title: "Standard Operating Procedures",
    description: "Create SOPs the system can suggest to employees resolving issues.",
    optional: true,
  },
  {
    key: "qr-codes", number: 8,
    title: "QR Codes",
    description: "Create scan points for location check-ins and anonymous issue reporting.",
    optional: true,
  },
  {
    key: "feature-flags", number: 9,
    title: "Feature Flags",
    description: "Enable or disable product capabilities for this customer.",
    optional: false,
  },
  {
    key: "employee-list", number: 10,
    title: "Employee Invitation List",
    description: "Prepare the employee list to be invited after the customer accepts their account.",
    optional: true,
  },
  {
    key: "readiness", number: 11,
    title: "Launch Readiness",
    description: "Final checklist review before sending the customer their invitation.",
    optional: false,
  },
]

export const WIZARD_STEP_KEYS = WIZARD_STEPS.map(s => s.key)

export function getStepWithStatuses(
  progress: WizardProgress | null,
): WizardStepWithStatus[] {
  const completed = new Set(progress?.completedSteps ?? [])
  const skipped   = new Set(progress?.skippedSteps ?? [])
  const current   = progress?.currentStepKey ?? WIZARD_STEPS[0].key

  return WIZARD_STEPS.map(step => {
    let status: StepStatus = "incomplete"
    if (step.key === current)       status = "current"
    else if (completed.has(step.key)) status = "completed"
    else if (skipped.has(step.key))   status = "skipped"
    return { ...step, status }
  })
}

export function defaultProgress(): WizardProgress {
  return {
    currentStepKey:  WIZARD_STEPS[0].key,
    completedSteps:  [],
    skippedSteps:    [],
    lastSavedAt:     null,
    stagedEmployees: [],
  }
}
