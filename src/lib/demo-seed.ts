import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { INDUSTRY_TEMPLATES, getTemplate } from "./industry-templates"
import { EMPLOYEE_TYPE_PRESETS } from "./employee-type-presets"
import { setWorkforceCommsPlanFlags } from "./workforce-comms"

export const DEFAULT_INDUSTRY = "Manufacturing"
const DEMO_SLUG_PREFIX        = "demo-"
const DEMO_TTL_MS             = 2 * 60 * 60 * 1000

// ─── Exported helpers ────────────────────────────────────────────────────────

export function getDemoCompanyName(industry: string) {
  return getTemplate(industry).demoCompanyName
}

export async function cleanupExpiredDemos() {
  const expired = await prisma.organization.findMany({
    where: { isDemo: true, demoExpiresAt: { lt: new Date() } },
    select: { id: true },
  })
  for (const org of expired) {
    await deleteOrganization(org.id)
  }
}

/**
 * Fully deletes an organization and all its data in FK-safe dependency order.
 * Direct `organization.delete()` fails because Postgres cascades to Users
 * before cascading to Issues, and IssueComment.authorId → User has no
 * onDelete action, causing a constraint violation. This function manually
 * deletes every dependent table in the correct bottom-up order.
 */
export async function deleteOrganization(orgId: string): Promise<void> {
  // ── 1. Break self-referential cycles that block row deletion ─────────────
  // User.managerId → User (no cascade), Location.parentId → Location (no cascade),
  // Location.safetyContactId → User (no cascade)
  await Promise.all([
    prisma.user.updateMany({
      where: { organizationId: orgId },
      data:  { managerId: null, employeeTypeId: null },
    }),
    prisma.location.updateMany({
      where: { organizationId: orgId },
      data:  { parentId: null, safetyContactId: null },
    }),
  ])

  // ── 2. Delete all children of Issue (IssueComment.authorId is the specific
  //       constraint that was failing — authorId → User has no cascade, so
  //       comments must be gone before Users are deleted) ───────────────────
  await Promise.all([
    prisma.issueComment.deleteMany({ where: { issue: { organizationId: orgId } } }),
    prisma.issueHistory.deleteMany({ where: { issue: { organizationId: orgId } } }),
    prisma.issueEscalation.deleteMany({ where: { issue: { organizationId: orgId } } }),
    prisma.attachment.deleteMany({ where: { issue: { organizationId: orgId } } }),
    prisma.notification.deleteMany({ where: { organizationId: orgId } }),
  ])

  // ── 3. Delete Suggestions + their attachments (Suggestion.convertedToIssueId
  //       → Issue must be cleared before Issue rows are deleted) ─────────────
  await prisma.attachment.deleteMany({ where: { suggestion: { organizationId: orgId } } })
  await prisma.suggestion.deleteMany({ where: { organizationId: orgId } })

  // ── 4. Delete Issues (all children gone, no more back-references) ─────────
  await prisma.issue.deleteMany({ where: { organizationId: orgId } })

  // ── 5. Delete remaining org-level records (all User/Issue/Asset refs safe now)
  await Promise.all([
    prisma.injuryReport.deleteMany({ where: { organizationId: orgId } }),
    prisma.purchaseRequest.deleteMany({ where: { organizationId: orgId } }),
    prisma.maintenanceSchedule.deleteMany({ where: { organizationId: orgId } }),
    prisma.invitation.deleteMany({ where: { organizationId: orgId } }),
    prisma.routingRule.deleteMany({ where: { organizationId: orgId } }),
    prisma.analyticsSnapshot.deleteMany({ where: { organizationId: orgId } }),
    prisma.orgNote.deleteMany({ where: { organizationId: orgId } }),
    prisma.impersonationLog.deleteMany({ where: { organizationId: orgId } }),
    prisma.superAdminAuditLog.deleteMany({ where: { orgId } }),
    prisma.emailTemplate.deleteMany({ where: { organizationId: orgId } }),
    prisma.assignment.deleteMany({ where: { orgId } }),
    prisma.announcement.deleteMany({ where: { orgId } }),
    prisma.emergencyBroadcast.deleteMany({ where: { orgId } }),
  ])

  // ── 6. Escalation steps before policies ──────────────────────────────────
  await prisma.escalationStep.deleteMany({ where: { policy: { organizationId: orgId } } })
  await prisma.escalationPolicy.deleteMany({ where: { organizationId: orgId } })

  // ── 7. SOPs (Issue.sopId → SOP; Issues are already gone) ─────────────────
  await prisma.sOP.deleteMany({ where: { organizationId: orgId } })

  // ── 8. MaintenanceLogs before Assets/Vendors ──────────────────────────────
  await prisma.maintenanceLog.deleteMany({ where: { asset: { organizationId: orgId } } })

  // ── 9. Assets and Vendors (no more referencing rows) ─────────────────────
  await Promise.all([
    prisma.asset.deleteMany({ where: { organizationId: orgId } }),
    prisma.vendor.deleteMany({ where: { organizationId: orgId } }),
  ])

  // ── 10. New feature models from extended schema ───────────────────────────
  await Promise.all([
    prisma.goalProgress.deleteMany({ where: { goal: { organizationId: orgId } } }),
    prisma.qrCodeSubmission.deleteMany({ where: { qrCode: { organizationId: orgId } } }),
  ])
  await Promise.all([
    prisma.executiveGoal.deleteMany({ where: { organizationId: orgId } }),
    prisma.executiveBriefing.deleteMany({ where: { organizationId: orgId } }),
    prisma.healthScore.deleteMany({ where: { organizationId: orgId } }),
    prisma.trendAlert.deleteMany({ where: { organizationId: orgId } }),
    prisma.qrCode.deleteMany({ where: { organizationId: orgId } }),
  ])

  // ── 11. User dependents, then Users ──────────────────────────────────────
  await Promise.all([
    prisma.userOrgMembership.deleteMany({ where: { organizationId: orgId } }),
    prisma.userSettings.deleteMany({ where: { user: { organizationId: orgId } } }),
    prisma.userLocation.deleteMany({ where: { user: { organizationId: orgId } } }),
    prisma.passwordResetToken.deleteMany({ where: { user: { organizationId: orgId } } }),
  ])
  await prisma.user.deleteMany({ where: { organizationId: orgId } })

  // ── 12. EmployeeTypes (Users gone, no more User.employeeTypeId references)
  await prisma.employeeType.deleteMany({ where: { organizationId: orgId } })

  // ── 13. Departments then Locations (in that order: Dept.locationId → Location)
  await prisma.department.deleteMany({ where: { organizationId: orgId } })
  await prisma.location.deleteMany({ where: { organizationId: orgId } })

  // ── 14. Finally the Organization itself ──────────────────────────────────
  await prisma.organization.delete({ where: { id: orgId } })
}

// ─── Issue seed types ────────────────────────────────────────────────────────

interface ResolvedData {
  days: number    // days after creation to mark resolved
  method: string
  rootCause?: string
  category?: string
  time?: string   // timeToResolve bucket
  cost?: number
}

interface IssueSeed {
  title: string
  desc: string
  cat: string
  pri: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  loc: number    // index into locations array
  days: number   // how many days ago (createdAt)
  status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
  asset?: number // index into assets array
  resolved?: ResolvedData
  escalated?: boolean
  lvl?: number
  // SOP violation linking
  sopIdx?: number        // index into template.demoSOPs array
  sopViolation?: boolean // true = flagged possible violation
  sopViolationNote?: string
}

// ─── User seeds (15 demo users per industry, same names/roles) ───────────────

interface UserSeed {
  name: string
  role: "MANAGER" | "SUPERVISOR" | "HR" | "EMPLOYEE"
  deptIdx: number  // index into template.departments
}

const DEMO_USERS: UserSeed[] = [
  { name: "Sarah Chen",       role: "MANAGER",    deptIdx: 0 },
  { name: "Marcus Johnson",   role: "MANAGER",    deptIdx: 1 },
  { name: "Lisa Park",        role: "HR",         deptIdx: 2 },
  { name: "Tom Rodriguez",    role: "SUPERVISOR", deptIdx: 0 },
  { name: "Amy Chen",         role: "SUPERVISOR", deptIdx: 3 },
  { name: "David Kim",        role: "SUPERVISOR", deptIdx: 0 },
  { name: "Mike Williams",    role: "EMPLOYEE",   deptIdx: 1 },
  { name: "Jennifer Brown",   role: "EMPLOYEE",   deptIdx: 0 },
  { name: "Carlos Torres",    role: "EMPLOYEE",   deptIdx: 4 },
  { name: "Rachel Scott",     role: "EMPLOYEE",   deptIdx: 2 },
  { name: "James Miller",     role: "EMPLOYEE",   deptIdx: 1 },
  { name: "Priya Patel",      role: "EMPLOYEE",   deptIdx: 0 },
  { name: "Derek Hughes",     role: "SUPERVISOR", deptIdx: 1 },
  { name: "Natalie Foster",   role: "EMPLOYEE",   deptIdx: 3 },
  { name: "Kevin Walsh",      role: "EMPLOYEE",   deptIdx: 1 },
]

// ─── Manufacturing issue data (65 seeds + 12 recurring) ─────────────────────

const MFG_ISSUES: IssueSeed[] = [
  // ── Recurring asset issues (asset index 0 = Conveyor Belt Line 3) ──────────
  { title: "Conveyor Belt Line 3 — E-stop triggered during shift", desc: "Conveyor emergency stop fired unexpectedly mid-run. Line 3 fully down. No injury but production halted.", cat: "EQUIPMENT_BREAKDOWN", pri: "CRITICAL", loc: 0, days: 2, status: "OPEN", asset: 0 },
  { title: "Conveyor Belt Line 3 — jammed at transfer point", desc: "Material backed up at the #4 transfer chute; belt jammed and stopped. Production down for 45 minutes.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 12, status: "RESOLVED", asset: 0, resolved: { days: 1, method: "Cleared jam at transfer point and adjusted guide rails to prevent recurrence", rootCause: "Misaligned guide rail allowed product to stack at transfer chute", category: "Adjusted/Calibrated", time: "1_4_hours", cost: 0 } },
  { title: "Conveyor Belt Line 3 — belt slipping on drive roller", desc: "Belt losing grip on main drive roller under load. Running 20% under capacity to avoid full stop.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 25, status: "RESOLVED", asset: 0, resolved: { days: 2, method: "Replaced drive roller lagging and adjusted belt tension", rootCause: "Drive roller lagging worn smooth — belt lost traction under load", category: "Repaired", time: "4_8_hours", cost: 340 } },
  { title: "Conveyor Belt Line 3 — tracking drift to left", desc: "Belt drifting left 2–3 inches. Will contact frame if not corrected. Running carefully until fixed.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 0, days: 40, status: "RESOLVED", asset: 0, resolved: { days: 1, method: "Adjusted tracking idlers and checked belt splice alignment", rootCause: "Idler mis-set after last belt replacement", category: "Adjusted/Calibrated", time: "1_4_hours", cost: 0 } },
  { title: "Conveyor Belt Line 3 — squealing sound under load", desc: "High-pitched squeal starts after about 10 minutes of operation. Getting louder daily.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 0, days: 58, status: "RESOLVED", asset: 0, resolved: { days: 1, method: "Lubricated all idler bearings; replaced two seized idlers", rootCause: "Three idler bearings run dry — no scheduled lubrication in last 90 days", category: "Repaired", time: "4_8_hours", cost: 180 } },
  { title: "Conveyor Belt Line 3 — foreign object stop triggered", desc: "Sensor detected foreign object and halted line. Object removed. Investigating how it entered line.", cat: "SAFETY", pri: "HIGH", loc: 0, days: 72, status: "RESOLVED", asset: 0, resolved: { days: 0, method: "Object removed, entry point sealed, added daily inspection checklist", rootCause: "Missing guard cover allowed small tool to fall onto belt", category: "Repaired", time: "under_1_hour", cost: 40 }, sopIdx: 2, sopViolation: true, sopViolationNote: "Possible SOP Violation: Weekly guard inspection (§ 3.4) may not have been completed — missing guard cover allowed foreign object onto belt" },
  { title: "Conveyor Belt Line 3 — tension loss, product falling off", desc: "Intermittent product falling off belt edge. Two units damaged. Belt tension visibly low.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 90, status: "RESOLVED", asset: 0, resolved: { days: 1, method: "Adjusted take-up mechanism and replaced worn tension springs", rootCause: "Take-up weights seized in guide channel, allowing belt to slacken", category: "Repaired", time: "4_8_hours", cost: 220 } },
  { title: "Conveyor Belt Line 3 — drive motor overheating", desc: "Drive motor temperature alarm triggered twice in last shift. Ambient temp normal. Motor running hot.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 110, status: "RESOLVED", asset: 0, resolved: { days: 3, method: "Replaced drive motor cooling fan and cleaned ventilation grilles", rootCause: "Cooling fan blade cracked — inadequate airflow caused motor to overheat", category: "Replaced", time: "1_2_days", cost: 890 } },
  { title: "Conveyor Belt Line 3 — belt splice failure mid-shift", desc: "Mechanical splice failed, splitting belt in two sections. Production fully halted for emergency repair.", cat: "EQUIPMENT_BREAKDOWN", pri: "CRITICAL", loc: 0, days: 130, status: "RESOLVED", asset: 0, resolved: { days: 1, method: "Emergency vulcanized splice installed; adjacent splice sections inspected", rootCause: "Mechanical splice hooks fatigued from repeated flexing over splice lifetime", category: "Repaired", time: "4_8_hours", cost: 1200 } },
  { title: "Conveyor Belt Line 3 — belt torn near return roller", desc: "Belt edge tearing at return roller on the left side. Chunks of belt found below line.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 150, status: "RESOLVED", asset: 0, resolved: { days: 2, method: "Replaced entire belt section and corrected return roller alignment", rootCause: "Return roller misaligned — continuously cutting into belt edge for weeks", category: "Replaced", time: "1_2_days", cost: 2100 } },
  { title: "Conveyor Belt Line 3 — speed inconsistent, QC flagged output", desc: "Belt speed varying ±15% causing spacing issues. QC placed hold on last hour of production.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 168, status: "RESOLVED", asset: 0, resolved: { days: 1, method: "Replaced variable frequency drive (VFD) — controller showing fault codes", rootCause: "VFD internal capacitor failure causing erratic speed signal output", category: "Replaced", time: "4_8_hours", cost: 1650 } },
  { title: "Conveyor Belt Line 3 — belt seized, full production halt", desc: "Belt completely locked up. Entire production line at a standstill. Emergency vendor call made.", cat: "EQUIPMENT_BREAKDOWN", pri: "CRITICAL", loc: 0, days: 183, status: "RESOLVED", asset: 0, resolved: { days: 2, method: "Replaced main drive shaft bearings and full belt re-tensioning", rootCause: "Main drive shaft bearings seized due to lubrication failure; catastrophic failure", category: "Replaced", time: "1_2_days", cost: 3400 } },

  // ── Escalated issue (will be handled specially) ──────────────────────────
  { title: "Hydraulic press Line 2 — pressure drop to zero", desc: "Hydraulic press on Line 2 lost all pressure during a production cycle. Line 2 completely down. Hydraulic fluid leak visible at base of press.", cat: "EQUIPMENT_BREAKDOWN", pri: "CRITICAL", loc: 0, days: 3, status: "OPEN", asset: 1, escalated: true, lvl: 2 },

  // ── Other equipment breakdowns ───────────────────────────────────────────
  { title: "CNC Machine #4 — spindle overheating at high RPM", desc: "Spindle temperature alarm triggered after 20 minutes of operation. Throttled to 60% capacity to continue.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 5, status: "IN_PROGRESS", asset: 2 },
  { title: "Air compressor system — pressure dropping below 90 PSI", desc: "Main air compressor can't sustain 100 PSI threshold. Pneumatic tools intermittently underpowered.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 8, status: "OPEN", asset: 3 },
  { title: "Overhead crane — limit switch malfunction Bay A", desc: "East limit switch on overhead crane not stopping movement correctly. Crane locked out until fixed.", cat: "EQUIPMENT_BREAKDOWN", pri: "CRITICAL", loc: 0, days: 6, status: "IN_PROGRESS" },
  { title: "Injection mold press — clamp not reaching full tonnage", desc: "Mold clamp reaching only 80% of rated tonnage. Parts showing flash on parting line. Quality hold placed.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 14, status: "RESOLVED", resolved: { days: 3, method: "Replaced hydraulic clamp cylinder seals and rebuilt clamp circuit", rootCause: "Internal seal failure in clamp cylinder — hydraulic bypass reducing clamping force", category: "Repaired", time: "1_2_days", cost: 780 } },
  { title: "Welding station 3 — MIG welder arc instability", desc: "Arc extinguishing intermittently. Weld quality poor — pitting and spattering. Station 3 offline.", cat: "EQUIPMENT_BREAKDOWN", pri: "MEDIUM", loc: 0, days: 18, status: "RESOLVED", resolved: { days: 1, method: "Replaced wire liner and cleaned contact tips; adjusted gas flow", rootCause: "Wire liner worn and bent — restricting wire feed causing arc dropout", category: "Repaired", time: "1_4_hours", cost: 65 } },
  { title: "Paint booth exhaust fan — reduced airflow detected", desc: "Booth airflow below safe minimum for solvent fumes. Paint ops paused pending inspection.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 22, status: "RESOLVED", resolved: { days: 1, method: "Replaced clogged pre-filters and cleaned fan housing", rootCause: "Filter media fully clogged — overdue for scheduled replacement by 3 weeks", category: "Repaired", time: "4_8_hours", cost: 140 } },
  { title: "Forklift Unit B — brake pedal spongy, no full stop", desc: "Brake pedal going to floor. Forklift stopping distance increased significantly. Taken out of service.", cat: "VEHICLE", pri: "CRITICAL", loc: 1, days: 4, status: "RESOLVED", asset: 4, resolved: { days: 1, method: "Replaced brake master cylinder and bled entire brake circuit", rootCause: "Master cylinder seal failure — hydraulic fluid bypassing piston, no brake pressure", category: "Replaced", time: "4_8_hours", cost: 420 } },
  { title: "CNC Machine #2 — tool changer carousel stuck", desc: "Automatic tool changer not rotating to next position. Machine halted mid-program. Manual loading only.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 28, status: "RESOLVED", resolved: { days: 2, method: "Replaced tool changer drive servo motor and re-calibrated carousel positions", rootCause: "Servo motor for carousel drive failed — position encoder giving fault signal", category: "Replaced", time: "1_2_days", cost: 1850 } },
  { title: "Packaging line sealer — temperature inconsistent", desc: "Heat sealer running 15°C below set point. Seals failing peel test. Line paused for QC hold.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 35, status: "RESOLVED", resolved: { days: 1, method: "Replaced heating element cartridge and recalibrated temperature controller", rootCause: "Heating cartridge burned out — controller reading sensor but element not firing", category: "Replaced", time: "4_8_hours", cost: 310 } },

  // ── Maintenance issues ────────────────────────────────────────────────────
  { title: "Forklift Unit A — 500-hour service overdue by 3 weeks", desc: "Unit A is 3 weeks past its scheduled 500-hour PM. Oil, filter, and brake inspection needed.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 1, days: 7, status: "IN_PROGRESS", asset: 4 },
  { title: "HVAC — production floor unit making rattling noise", desc: "Unit above line 1 rattling since yesterday. Temp still OK but noise getting louder each day.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 0, days: 9, status: "IN_PROGRESS" },
  { title: "Roof drain clogged — water pooling on east loading dock", desc: "Standing water 2 inches deep near dock door 4. Slip hazard and possible interior damage.", cat: "FACILITY", pri: "HIGH", loc: 1, days: 2, status: "OPEN" },
  { title: "Dock door #3 — seal worn, cold air infiltration", desc: "Dock seal badly worn on left side. Temperature in dock area 8°F below spec. Affects perishable inventory.", cat: "FACILITY", pri: "MEDIUM", loc: 1, days: 11, status: "IN_PROGRESS" },
  { title: "Battery charging station — 2 of 6 charger bays dead", desc: "Charger bays 2 and 5 not activating. Batteries returned uncharged twice this week.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 1, days: 15, status: "RESOLVED", resolved: { days: 1, method: "Reset circuit breakers; replaced faulty breaker on bay 5", rootCause: "Bay 2 breaker tripped; bay 5 breaker had failed open internally", category: "Repaired", time: "1_4_hours", cost: 45 } },
  { title: "Compressed air line — leak at union joint Zone C", desc: "Audible air leak at pipe union near Zone C assembly. Estimated 8% capacity loss.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 0, days: 19, status: "RESOLVED", resolved: { days: 1, method: "Replaced union fitting and applied thread sealant", rootCause: "Union fitting threads had backed out — vibration from nearby equipment", category: "Repaired", time: "1_4_hours", cost: 25 } },
  { title: "Overhead lighting — 6 bulbs out in Warehouse Section B", desc: "Section B progressively darker. Safety concern for picking and load verification tasks.", cat: "FACILITY", pri: "MEDIUM", loc: 1, days: 23, status: "RESOLVED", resolved: { days: 2, method: "Replaced all 6 LED bay lights and inspected remaining fixtures", rootCause: "Batch of LEDs from last order had early failure rate — vendor informed", category: "Replaced", time: "4_8_hours", cost: 380 } },
  { title: "Floor marking paint worn in high-traffic aisles", desc: "Lane markings in aisles 3, 5, and 7 completely worn away. Affects pedestrian/forklift separation.", cat: "SAFETY", pri: "MEDIUM", loc: 1, days: 32, status: "RESOLVED", resolved: { days: 2, method: "Repainted all aisle markings with heavy-duty epoxy floor paint", rootCause: "Standard paint specified in last project insufficient for this traffic level", category: "Repaired", time: "1_2_days", cost: 620 } },
  { title: "Cooling tower — scale buildup reducing flow rate", desc: "Cooling tower flow reading 35% below baseline. Chemical treatment hasn't cleared the buildup.", cat: "MAINTENANCE", pri: "HIGH", loc: 0, days: 44, status: "RESOLVED", resolved: { days: 4, method: "Professional descaling service + updated water treatment dosing schedule", rootCause: "Water treatment dosing undercalculated for summer heat load — scale accumulated over 60 days", category: "Vendor Resolved", time: "3_5_days", cost: 2800 } },
  { title: "Restroom plumbing — men's room faucets dripping", desc: "Both faucets in men's restroom running constantly. Estimate 50 gallons/day waste.", cat: "FACILITY", pri: "LOW", loc: 2, days: 16, status: "RESOLVED", resolved: { days: 1, method: "Replaced cartridges in both faucet handles", rootCause: "Original faucet cartridges worn after 7 years of service", category: "Replaced", time: "under_1_hour", cost: 35 } },

  // ── Safety issues ─────────────────────────────────────────────────────────
  { title: "Spill — hydraulic fluid on aisle floor near press 4", desc: "Hydraulic fluid spill approximately 3 feet wide in pedestrian/forklift shared aisle. Slip hazard.", cat: "SAFETY", pri: "CRITICAL", loc: 0, days: 1, status: "OPEN" },
  { title: "Safety harness inspection overdue — all 12 units", desc: "Annual harness inspection missed by 3 weeks. OSHA requires certification before any fall-protection work.", cat: "SAFETY", pri: "CRITICAL", loc: 0, days: 3, status: "IN_PROGRESS" },
  { title: "Emergency exit sign — Mezzanine stairwell B dark", desc: "Exit sign near stairwell B dark. Battery backup possibly dead. Next inspection in 2 weeks.", cat: "SAFETY", pri: "HIGH", loc: 0, days: 5, status: "IN_PROGRESS" },
  { title: "Fire extinguisher — 3 units expired, Line 1 area", desc: "Three extinguishers in Line 1 area past annual service date. Must be replaced before Monday.", cat: "SAFETY", pri: "HIGH", loc: 0, days: 7, status: "RESOLVED", resolved: { days: 1, method: "Vendor replaced all 3 units; full compliance audit scheduled", rootCause: "Extinguisher vendor skipped Line 1 during last annual visit", category: "Vendor Resolved", time: "under_1_hour", cost: 180 } },
  { title: "Machine guard missing — laser cutter station 2", desc: "Side panel guard removed for maintenance and not replaced. Station 2 unsafe until guard reinstalled.", cat: "SAFETY", pri: "CRITICAL", loc: 0, days: 1, status: "RESOLVED", resolved: { days: 0, method: "Guard reinstalled immediately; maintenance procedure updated to require sign-off before return to service", rootCause: "Maintenance team did not follow guard reinstallation checklist after repair", category: "Training/Process Fix", time: "under_1_hour", cost: 0 }, sopIdx: 1, sopViolation: true, sopViolationNote: "Possible SOP Violation: LOTO procedure § 5.2 requires all guards to be reinstalled and verified before restoring energy — equipment was returned to service without guard reinstallation" },
  { title: "Pallets blocking fire lane — Warehouse Zone D", desc: "Overflow pallets stacked in designated fire lane, reducing clearance to under 24 inches.", cat: "SAFETY", pri: "HIGH", loc: 1, days: 8, status: "RESOLVED", resolved: { days: 0, method: "Pallets relocated to overflow staging area; fire lane cleared", rootCause: "Receiving processed an unscheduled shipment with no staging space available", category: "Training/Process Fix", time: "under_1_hour", cost: 0 } },
  { title: "Chemical storage — SDS binder out of date", desc: "Hazmat SDS binder missing 4 chemicals added in last 6 months. Must update before OSHA audit.", cat: "SAFETY", pri: "HIGH", loc: 0, days: 20, status: "RESOLVED", resolved: { days: 2, method: "Updated SDS binder with all current chemicals; digital copy added to shared drive", rootCause: "New chemical onboarding process did not include SDS binder update step", category: "Training/Process Fix", time: "1_2_days", cost: 0 } },
  { title: "Wet floor — roof leak over receiving dock area", desc: "Roof leak dripping onto dock floor after last night's rain. Wet floor sign placed. Slip risk.", cat: "SAFETY", pri: "HIGH", loc: 1, days: 2, status: "OPEN" },

  // ── Quality control ────────────────────────────────────────────────────────
  { title: "Calibration drift on CMM machine — out-of-spec parts", desc: "CMM coordinate measuring machine showing 0.04mm drift since last calibration. All parts since Monday on hold.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 4, status: "IN_PROGRESS", asset: 2 },
  { title: "Incoming inspection — supplier batch #4412 rejected", desc: "15% defect rate on last supplier batch. Supplier notified. Parts in quarantine.", cat: "GENERAL", pri: "HIGH", loc: 2, days: 10, status: "IN_PROGRESS" },
  { title: "Torque wrench — calibration certificate expired", desc: "Line 2 torque wrench certificate expired 6 days ago. Must recalibrate before use on certified fasteners.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 0, days: 6, status: "RESOLVED", resolved: { days: 1, method: "Sent to external calibration lab, returned next day with certificate", rootCause: "Calibration expiry date not tracked in maintenance calendar", category: "Vendor Resolved", time: "1_2_days", cost: 95 } },
  { title: "Label printer — barcode quality check failing", desc: "Barcode scanner rejecting 30% of labels from printer 2. Labels too light; scanner can't read.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 12, status: "RESOLVED", resolved: { days: 1, method: "Replaced printhead and recalibrated darkness/speed settings", rootCause: "Printhead worn — darkness setting cranked up to compensate was masking real issue", category: "Replaced", time: "1_4_hours", cost: 310 } },
  { title: "Surface finish defects — Line 4 output flagged", desc: "QC hold on 3 hours of Line 4 production. Surface finish outside spec. Investigating cause.", cat: "GENERAL", pri: "HIGH", loc: 0, days: 15, status: "RESOLVED", resolved: { days: 2, method: "Cleaned coolant nozzles and replaced coolant that had tramp oil contamination", rootCause: "Coolant contaminated with tramp oil from hydraulic leak — affecting surface finish", category: "Repaired", time: "4_8_hours", cost: 240 } },

  // ── Vehicle issues ─────────────────────────────────────────────────────────
  { title: "Company Van #2 — oil leak, parking spot staining", desc: "Consistent oil pool under Van #2 every morning. Van still running but should not be driven long distance.", cat: "VEHICLE", pri: "HIGH", loc: 2, days: 6, status: "IN_PROGRESS" },
  { title: "Forklift Unit C — horn not working", desc: "Horn button produces no sound. Safety requirement for pedestrian warning in warehouse.", cat: "VEHICLE", pri: "HIGH", loc: 1, days: 3, status: "RESOLVED", resolved: { days: 0, method: "Replaced horn relay and tested — horn functioning at spec", rootCause: "Horn relay contacts burned open", category: "Replaced", time: "under_1_hour", cost: 18 } },
  { title: "Yard truck — seat belt frayed and partially torn", desc: "Driver side seat belt frayed through the outer layer. One strand remaining. Immediate replacement needed.", cat: "VEHICLE", pri: "CRITICAL", loc: 1, days: 1, status: "RESOLVED", resolved: { days: 0, method: "Replaced seat belt assembly; put unit back in service after inspection", rootCause: "Seat belt had never been replaced in 7-year service life", category: "Replaced", time: "under_1_hour", cost: 75 } },

  // ── Facilities / general ──────────────────────────────────────────────────
  { title: "Break room refrigerator — not cooling below 50°F", desc: "Fridge temp at 54°F this morning. Employee food risk. Unit should be repaired or replaced.", cat: "FACILITY", pri: "MEDIUM", loc: 2, days: 3, status: "IN_PROGRESS" },
  { title: "Electrical panel — breaker B7 tripping weekly", desc: "Breaker B7 tripping once per week, cutting power to offices 204–208. Reset each time but pattern worsening.", cat: "FACILITY", pri: "HIGH", loc: 2, days: 17, status: "RESOLVED", resolved: { days: 2, method: "Electrician replaced B7 breaker and audited panel for overload conditions", rootCause: "Breaker was undersized for actual load on circuit — per code should have been 30A, was 20A", category: "Replaced", time: "4_8_hours", cost: 380 } },
  { title: "Internet outage — Plant floor network switch failed", desc: "Network switch in MDF room failed, taking down all plant floor IoT sensors and PLC connections.", cat: "FACILITY", pri: "CRITICAL", loc: 0, days: 45, status: "RESOLVED", resolved: { days: 0, method: "Swapped in spare switch from IT room; full connectivity restored in 40 minutes", rootCause: "Switch power supply unit failed — unit was 9 years old, end-of-life", category: "Replaced", time: "under_1_hour", cost: 1200 } },
  { title: "HVAC — chiller showing high refrigerant pressure alarm", desc: "Chiller HVAC unit throwing high-pressure fault every afternoon. Resetting manually each time. Needs inspection.", cat: "MAINTENANCE", pri: "HIGH", loc: 0, days: 50, status: "RESOLVED", resolved: { days: 3, method: "HVAC vendor found and fixed refrigerant restriction in expansion valve", rootCause: "TXV (thermal expansion valve) partially blocked — caused high head pressure", category: "Vendor Resolved", time: "3_5_days", cost: 950 } },
  { title: "Loading dock leveler — won't lock in raised position", desc: "Dock leveler 2 drops slowly after raising. Cannot safely load trailers without it locking.", cat: "FACILITY", pri: "HIGH", loc: 1, days: 55, status: "RESOLVED", resolved: { days: 1, method: "Replaced dock leveler hydraulic lock valve", rootCause: "Internal leak in lock valve allowing slow pressure bleed-off", category: "Replaced", time: "4_8_hours", cost: 560 } },
  { title: "Eyewash station — Lab area non-functional", desc: "Eyewash station near chemical lab not flowing when activated. Required by OSHA for chemical work areas.", cat: "SAFETY", pri: "CRITICAL", loc: 0, days: 60, status: "RESOLVED", resolved: { days: 0, method: "Replaced seized shut-off valve; eyewash fully operational", rootCause: "Shut-off valve rusted closed during extended inactivity — should be tested weekly", category: "Repaired", time: "under_1_hour", cost: 30 } },
  { title: "Supply shortage — absorbent pads for spill kit depleted", desc: "All spill kits on production floor have been depleted. Cannot respond to hydraulic or chemical spills.", cat: "GENERAL", pri: "HIGH", loc: 0, days: 1, status: "OPEN" },
  { title: "Compressed air dryer — dew point rising above spec", desc: "Air dryer not drying adequately. Moisture appearing in pneumatic lines. Corrosion risk to air tools.", cat: "MAINTENANCE", pri: "HIGH", loc: 0, days: 80, status: "RESOLVED", resolved: { days: 2, method: "Replaced desiccant drying tower media and purge valve", rootCause: "Desiccant media saturated and not regenerating properly — purge valve stuck", category: "Repaired", time: "1_2_days", cost: 640 } },
  { title: "Pest control — rodent evidence found in grain storage", desc: "Rodent droppings found near raw material storage. Health risk. Pest control vendor called.", cat: "SAFETY", pri: "HIGH", loc: 1, days: 90, status: "RESOLVED", resolved: { days: 2, method: "Pest control treatment completed; entry points sealed", rootCause: "Dock door 6 weather seal gap large enough for rodent entry", category: "Vendor Resolved", time: "1_2_days", cost: 450 } },
  { title: "Intercom system — 3 stations not working in Warehouse", desc: "Stations W4, W6, and W9 have no audio. Communication gap in loading zone.", cat: "FACILITY", pri: "LOW", loc: 1, days: 100, status: "RESOLVED", resolved: { days: 3, method: "Replaced wiring harness in affected stations; corroded connectors found", rootCause: "Condensation from dock doors corroded station connector blocks over 18 months", category: "Replaced", time: "1_2_days", cost: 320 } },
  { title: "Scaffolding — inspection certificate expired for south mezzanine", desc: "Scaffolding on south mezzanine has an expired inspection cert. Must not be used until re-inspected.", cat: "SAFETY", pri: "HIGH", loc: 0, days: 110, status: "RESOLVED", resolved: { days: 1, method: "Scaffolding engineer completed inspection; certificate renewed", rootCause: "Annual inspection scheduled in software but notification not routed to facilities manager", category: "Vendor Resolved", time: "1_2_days", cost: 280 } },
  { title: "Boiler — low water cut-off tripping on startup", desc: "Boiler tripping on low water cut-off every 2nd or 3rd startup. Manual reset required. Unreliable for heating.", cat: "MAINTENANCE", pri: "HIGH", loc: 0, days: 130, status: "RESOLVED", resolved: { days: 2, method: "Replaced low water cut-off float assembly and flushed boiler feedwater system", rootCause: "Float in low water cut-off partially waterlogged — giving false low reading on startup", category: "Replaced", time: "4_8_hours", cost: 780 } },
  { title: "Forklift Unit D — charging cable frayed at plug end", desc: "Charging cable outer jacket split 4 inches from the plug. Potential shock hazard. Unit grounded.", cat: "VEHICLE", pri: "HIGH", loc: 1, days: 140, status: "RESOLVED", resolved: { days: 0, method: "Replaced charging cable assembly", rootCause: "Cable was repeatedly run over by other forklifts at charging station", category: "Replaced", time: "under_1_hour", cost: 95 }, sopIdx: 3, sopViolation: true, sopViolationNote: "Possible SOP Violation: Battery charging procedure § 2.4 requires charging cable inspection before every charge cycle — cable damage of this severity indicates pre-charge inspection was not being performed" },
  { title: "Smoke detector — 2 units chirping (low battery) in Office", desc: "Smoke detectors 3 and 7 in corporate office chirping. Battery replacement needed.", cat: "FACILITY", pri: "LOW", loc: 2, days: 6, status: "RESOLVED", resolved: { days: 0, method: "Replaced batteries in both units; tested alarm function — both OK", rootCause: "Batteries approaching end of life — on standard 12-month replacement cycle", category: "Replaced", time: "under_1_hour", cost: 8 } },
  { title: "Parking lot — potholes near main entrance", desc: "Two significant potholes near main entrance creating trip hazard and vehicle damage risk.", cat: "FACILITY", pri: "MEDIUM", loc: 2, days: 60, status: "RESOLVED", resolved: { days: 7, method: "Parking lot patching crew filled both potholes with cold-mix asphalt", rootCause: "Normal freeze-thaw deterioration; maintenance deferred from last season", category: "Repaired", time: "1_plus_weeks", cost: 1200 } },
]

// ─── Warehousing issue data (45 seeds) ───────────────────────────────────────

const WH_ISSUES: IssueSeed[] = [
  // Recurring: Dock Door 7 (asset 0)
  { title: "Dock door 7 — seal failing, temperature gap", desc: "Door seal worn on both vertical edges. Cold air infiltration affecting temperature-controlled zone.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 0, days: 5, status: "OPEN", asset: 0 },
  { title: "Dock door 7 — hydraulic leveler stuck down", desc: "Dock leveler won't raise. Manually raised and propped for last two loads. Needs repair.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 18, status: "RESOLVED", asset: 0, resolved: { days: 1, method: "Replaced hydraulic pump solenoid", rootCause: "Solenoid coil burned out", category: "Replaced", time: "4_8_hours", cost: 340 } },
  { title: "Dock door 7 — motor overheating on open cycle", desc: "Door motor getting hot on each open cycle. Taking 3x normal time to open.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 45, status: "RESOLVED", asset: 0, resolved: { days: 2, method: "Replaced opener motor and lubricated track", rootCause: "Track debris causing motor to work harder; motor windings stressed", category: "Replaced", time: "1_2_days", cost: 720 } },
  { title: "Dock door 7 — panel dented, won't close fully", desc: "Bottom panel dented inward — door stops 6 inches from floor. Security gap overnight.", cat: "FACILITY", pri: "HIGH", loc: 0, days: 80, status: "RESOLVED", asset: 0, resolved: { days: 3, method: "Replaced bottom panel section", rootCause: "Forklift operator struck door during backing maneuver", category: "Replaced", time: "3_5_days", cost: 890 } },
  { title: "Dock door 7 — spring tension loss, closing too fast", desc: "Door slams down when closing. Dangerous for personnel near door. Posted warning signs.", cat: "SAFETY", pri: "CRITICAL", loc: 0, days: 120, status: "RESOLVED", asset: 0, resolved: { days: 0, method: "Replaced both counterbalance springs", rootCause: "Springs fatigued after 5 years of daily cycles", category: "Replaced", time: "4_8_hours", cost: 560 } },

  // Escalated
  { title: "Forklift #3 — mast chain failure, load dropped", desc: "Mast chain snapped while lifting. 800lb pallet dropped 4 feet. No injury but near miss. Forklift locked out.", cat: "EQUIPMENT_BREAKDOWN", pri: "CRITICAL", loc: 0, days: 2, status: "OPEN", asset: 1, escalated: true, lvl: 2, sopIdx: 0, sopViolation: true, sopViolationNote: "Possible SOP Violation: Daily inspection procedure § 5.1 requires mast chain inspection every shift — chain failure of this severity suggests the required hands-on chain inspection was not completed" },

  // Other equipment
  { title: "Conveyor sorter — jam at merge point gate 3", desc: "Items backing up and jamming at merge gate 3. Sorter running at 50% to manage.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 3, status: "IN_PROGRESS" },
  { title: "Stretch wrap machine — film roll tension off", desc: "Wrap not applying consistent tension. Pallet loads shifting during transport.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 1, days: 7, status: "RESOLVED", resolved: { days: 1, method: "Replaced pre-stretch rollers and reset tension calibration", rootCause: "Pre-stretch rollers worn smooth", category: "Replaced", time: "4_8_hours", cost: 285 } },
  { title: "Barcode scanner — handheld unit 4 not reading", desc: "Scanner 4 getting worse read rates — down to 40%. Slowing receiving operations.", cat: "EQUIPMENT_BREAKDOWN", pri: "MEDIUM", loc: 1, days: 10, status: "RESOLVED", resolved: { days: 0, method: "Replaced scan engine; recalibrated", rootCause: "Scan engine worn", category: "Replaced", time: "under_1_hour", cost: 180 } },
  { title: "Pallet jack — electric unit 2 battery not holding charge", desc: "Battery draining in 2 hours instead of 8. Productivity down in Aisle D.", cat: "EQUIPMENT_BREAKDOWN", pri: "MEDIUM", loc: 0, days: 12, status: "OPEN" },
  { title: "WMS workstation — screen freezing on label print", desc: "Workstation at receiving door 2 freezes when printing labels. Requires hard reset.", cat: "FACILITY", pri: "MEDIUM", loc: 1, days: 14, status: "IN_PROGRESS" },
  { title: "Dock leveler 5 — won't lock level with trailer", desc: "Leveler raises but immediately drops to floor level. Can't bridge trailer gap safely.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 20, status: "RESOLVED", resolved: { days: 1, method: "Replaced safety leg assembly and hydraulic lock valve", rootCause: "Lock valve seat eroded — leaking under load", category: "Replaced", time: "4_8_hours", cost: 470 } },
  { title: "Receiving scale — weighing 40 lbs light", desc: "Platform scale at Door 1 reading 40 lbs under actual weight. Shipments under-recorded.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 1, days: 8, status: "RESOLVED", resolved: { days: 1, method: "Recalibrated load cells and replaced one faulty cell", rootCause: "Load cell 3 failed partially — combined reading thrown off", category: "Repaired", time: "4_8_hours", cost: 220 } },

  // Safety
  { title: "Sprinkler head — struck by forklift in Aisle F", desc: "Forklift clipped sprinkler head. Head deformed but did not discharge. Building inspector notified.", cat: "SAFETY", pri: "CRITICAL", loc: 0, days: 1, status: "OPEN" },
  { title: "Floor marking — pedestrian walkway lines faded", desc: "Safety line markings in pedestrian crosswalk near shipping worn down. Repaint needed.", cat: "SAFETY", pri: "MEDIUM", loc: 0, days: 15, status: "RESOLVED", resolved: { days: 2, method: "Repainted all walkway markings with epoxy paint", rootCause: "High forklift traffic wore marks faster than standard schedule", category: "Repaired", time: "1_2_days", cost: 480 } },
  { title: "Slip hazard — condensation on dock floor", desc: "Morning condensation on dock floor near Door 3. Two close calls this week. Anti-slip mats needed.", cat: "SAFETY", pri: "HIGH", loc: 0, days: 4, status: "IN_PROGRESS" },
  { title: "Fire suppression system — monthly inspection overdue", desc: "Sprinkler system monthly visual inspection overdue by 2 weeks.", cat: "SAFETY", pri: "HIGH", loc: 0, days: 20, status: "RESOLVED", resolved: { days: 0, method: "Completed inspection; one head replaced due to corrosion", rootCause: "Inspection not assigned after previous safety coordinator left", category: "Vendor Resolved", time: "under_1_hour", cost: 65 } },

  // Inventory/Operations
  { title: "Inventory count — Zone B SKU discrepancy 340 units", desc: "Cycle count found 340-unit discrepancy in Zone B. Investigating receiving records.", cat: "GENERAL", pri: "HIGH", loc: 0, days: 6, status: "IN_PROGRESS" },
  { title: "Label printer — warehouse unit 3 streaking", desc: "Labels printing with horizontal streaks. Barcode scan quality dropping.", cat: "EQUIPMENT_BREAKDOWN", pri: "MEDIUM", loc: 0, days: 9, status: "RESOLVED", resolved: { days: 0, method: "Cleaned printhead with IPA; replaced partial wear section", rootCause: "Adhesive buildup on printhead from label backing paper", category: "Repaired", time: "under_1_hour", cost: 0 } },
  { title: "Loading bay — trailer position sensor not detecting", desc: "Vehicle restraint system not detecting trailer. Operating door manually without restraint.", cat: "SAFETY", pri: "HIGH", loc: 0, days: 22, status: "RESOLVED", resolved: { days: 1, method: "Replaced proximity sensor and recalibrated system", rootCause: "Sensor face corroded — no signal output", category: "Replaced", time: "4_8_hours", cost: 195 } },

  // Facility
  { title: "HVAC — receiving area cold in mornings", desc: "Receiving area temperature dropping to 48°F before 9am. Workers uncomfortable, productivity affected.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 1, days: 25, status: "RESOLVED", resolved: { days: 3, method: "HVAC vendor replaced zone damper actuator", rootCause: "Zone damper actuator seized in closed position — no heat delivery to zone", category: "Vendor Resolved", time: "3_5_days", cost: 680 } },
  { title: "Roof leak — water dripping into rack Aisle C", desc: "Roof leak above Aisle C racks after heavy rain. Damaged 18 cartons. Tarps placed temporarily.", cat: "FACILITY", pri: "HIGH", loc: 0, days: 30, status: "RESOLVED", resolved: { days: 5, method: "Roofer patched seam separation near HVAC unit penetration", rootCause: "Flashing around HVAC penetration had separated over winter", category: "Vendor Resolved", time: "3_5_days", cost: 1600 } },
  { title: "Battery room ventilation — fan making noise", desc: "Exhaust fan in battery charging room making grinding noise. Hydrogen venting may be inadequate.", cat: "SAFETY", pri: "HIGH", loc: 0, days: 35, status: "RESOLVED", resolved: { days: 1, method: "Replaced fan motor bearings and cleaned fan blades", rootCause: "Bearing failure after 4 years of continuous operation", category: "Repaired", time: "4_8_hours", cost: 140 }, sopIdx: 2, sopViolation: true, sopViolationNote: "Possible SOP Violation: Battery charging procedure § 2.1 requires ventilation fan verification before connecting any battery — a grinding fan may have been operating below safe ventilation capacity during this period" },
  { title: "Compressed air — main line pressure drop overnight", desc: "System shows 30 PSI drop overnight when no tools running. Air leak somewhere on main loop.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 0, days: 50, status: "RESOLVED", resolved: { days: 2, method: "Found and repaired 3 leak points using ultrasonic leak detector", rootCause: "Three couplings had gradual leaks; undetected without ultrasonic scan", category: "Repaired", time: "1_2_days", cost: 95 } },
  { title: "Parking lot lighting — 4 fixtures out in north lot", desc: "North lot has 4 non-working light fixtures. Security and safety concern for evening shift.", cat: "FACILITY", pri: "MEDIUM", loc: 0, days: 60, status: "RESOLVED", resolved: { days: 3, method: "Replaced LED drivers and bulbs in all 4 fixtures", rootCause: "LED driver end-of-life failure — all same age/batch", category: "Replaced", time: "3_5_days", cost: 620 } },

  // More diverse issues
  { title: "Pest — rodent traps activated near food-grade storage", desc: "Two rodent traps activated near food-grade raw materials. Product on hold pending inspection.", cat: "SAFETY", pri: "HIGH", loc: 1, days: 70, status: "RESOLVED", resolved: { days: 2, method: "Pest control company treated; sealed 2 entry points", rootCause: "Gap under fire door provided entry point", category: "Vendor Resolved", time: "1_2_days", cost: 380 } },
  { title: "Rack safety — upright column bent Aisle H, Bay 4", desc: "Rack upright bent at base — impact damage from forklift. Rack contents temporarily removed.", cat: "SAFETY", pri: "CRITICAL", loc: 0, days: 85, status: "RESOLVED", resolved: { days: 3, method: "Rack repair specialist replaced column; full rack inspection completed", rootCause: "Forklift clipped upright during tight turn — not reported until inspection", category: "Replaced", time: "3_5_days", cost: 1800 } },
  { title: "Forklift #2 — LPG fuel line smell detected", desc: "Operator reported fuel smell near engine. Forklift removed from service. Fuel line inspection needed.", cat: "VEHICLE", pri: "CRITICAL", loc: 0, days: 95, status: "RESOLVED", resolved: { days: 0, method: "Found and tightened loose fuel line fitting; tested for leaks — clear", rootCause: "Vibration loosened fuel line quick-disconnect fitting over time", category: "Repaired", time: "under_1_hour", cost: 0 } },
  { title: "Conveyor sortation — photoeye sensor dirty causing rejects", desc: "Divert misreads spiking — rejects up 400%. Photoeye lenses found dirty.", cat: "MAINTENANCE", pri: "HIGH", loc: 0, days: 100, status: "RESOLVED", resolved: { days: 0, method: "Cleaned all photoeye lenses on sortation line", rootCause: "Dust buildup on lenses from nearby aisle sweeping; cleaning schedule too infrequent", category: "Training/Process Fix", time: "under_1_hour", cost: 0 } },
  { title: "WMS — label template printing wrong size for large carton", desc: "Large-carton label template outputting 4x6 instead of 6x8. Labels too small for carton.", cat: "GENERAL", pri: "MEDIUM", loc: 1, days: 110, status: "RESOLVED", resolved: { days: 1, method: "Updated label template in WMS system; reprinted affected cartons", rootCause: "WMS update changed default template mapping for carton size class 3", category: "Repaired", time: "1_4_hours", cost: 0 } },
  { title: "Receiving dock — truck parking guidance faded", desc: "Painted truck lane guides on exterior dock completely faded. Trucks parking misaligned.", cat: "FACILITY", pri: "LOW", loc: 0, days: 130, status: "RESOLVED", resolved: { days: 3, method: "Repainted exterior dock guidance lines with traffic-grade paint", rootCause: "Standard paint used last time; should have used road-grade marking paint", category: "Repaired", time: "3_5_days", cost: 320 } },
  { title: "Shipping — label scanner at pack station intermittent", desc: "Pack station scanner dropping connection every 15–20 minutes. Packing team manually logging.", cat: "EQUIPMENT_BREAKDOWN", pri: "MEDIUM", loc: 1, days: 140, status: "RESOLVED", resolved: { days: 1, method: "Replaced USB cable and scanner cradle — connection issue was mechanical", rootCause: "USB cable bent at connector end — intermittent continuity", category: "Replaced", time: "under_1_hour", cost: 22 } },
  { title: "Sprinkler inspection — quarterly test not completed", desc: "Quarterly sprinkler flow test not completed per schedule. Building code violation risk.", cat: "SAFETY", pri: "HIGH", loc: 0, days: 155, status: "RESOLVED", resolved: { days: 1, method: "Completed quarterly test; all heads functional", rootCause: "Test was assigned but no confirmation collected; fell through the cracks", category: "Training/Process Fix", time: "4_8_hours", cost: 0 } },
  { title: "Dock bumpers — 3 units crumbling at Door 1-3", desc: "Rubber dock bumpers at Doors 1, 2, 3 crumbling. Trailer contact with concrete causing damage.", cat: "FACILITY", pri: "MEDIUM", loc: 0, days: 165, status: "RESOLVED", resolved: { days: 5, method: "Replaced all 6 bumper pads with heavy-duty UHMW type", rootCause: "Original foam bumpers not rated for this trailer frequency", category: "Replaced", time: "3_5_days", cost: 480 } },
]

// ─── Hospitality issue data (40 seeds) ────────────────────────────────────────

const HOSP_ISSUES: IssueSeed[] = [
  // Recurring: HVAC Unit Room Block C (asset 0)
  { title: "HVAC Room Block C — cooling not reaching set temp", desc: "Rooms 301–320 temperature 4°F above thermostat setting. Guest complaints filed.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 3, status: "OPEN", asset: 0 },
  { title: "HVAC Room Block C — unit rattling, guest complaint", desc: "Three guests in Block C called front desk about rattling from ceiling unit.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 0, days: 22, status: "RESOLVED", asset: 0, resolved: { days: 1, method: "Tightened loose screws on fan housing", rootCause: "Fan mounting screws vibrated loose over time", category: "Repaired", time: "under_1_hour", cost: 0 } },
  { title: "HVAC Room Block C — thermostat unresponsive", desc: "Guest reports thermostat not responding to any input. Room 308 manually set to cold.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 50, status: "RESOLVED", asset: 0, resolved: { days: 0, method: "Replaced thermostat unit", rootCause: "Thermostat circuit board failure", category: "Replaced", time: "under_1_hour", cost: 85 } },
  { title: "HVAC Room Block C — condensate drain backing up", desc: "Condensate from Block C HVAC draining slowly — water marks on ceiling of rooms below.", cat: "MAINTENANCE", pri: "HIGH", loc: 0, days: 88, status: "RESOLVED", asset: 0, resolved: { days: 1, method: "Cleared drain line and added biocide treatment", rootCause: "Algae growth partially blocked condensate drain line", category: "Repaired", time: "4_8_hours", cost: 45 } },
  { title: "HVAC Room Block C — refrigerant low, warm air only", desc: "Block C HVAC only producing warm air. Refrigerant likely low. Rooms all transferred.", cat: "EQUIPMENT_BREAKDOWN", pri: "CRITICAL", loc: 0, days: 130, status: "RESOLVED", asset: 0, resolved: { days: 2, method: "Found and repaired refrigerant leak; recharged system", rootCause: "Pin-hole leak in evaporator coil — slow leak over 6 months", category: "Repaired", time: "1_2_days", cost: 1200 } },

  // Escalated
  { title: "Elevator — out of service, stuck between floors", desc: "Elevator stuck between floors 2 and 3. No guests inside but unit completely offline.", cat: "EQUIPMENT_BREAKDOWN", pri: "CRITICAL", loc: 0, days: 1, status: "OPEN", escalated: true, lvl: 2 },

  // Guest complaints / room issues
  { title: "Room 415 — hot water not working, guest relocated", desc: "Guest in 415 reported no hot water. Plumber found mixing valve failed. Guest moved to 417.", cat: "MAINTENANCE", pri: "HIGH", loc: 0, days: 2, status: "RESOLVED", resolved: { days: 0, method: "Replaced shower mixing valve", rootCause: "Valve cartridge failed — normal wear after 8 years", category: "Replaced", time: "1_4_hours", cost: 145 } },
  { title: "Pool heater — not maintaining 82°F target temp", desc: "Pool temperature at 76°F this morning. Guests commenting on cold water.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 1, days: 4, status: "IN_PROGRESS" },
  { title: "Restaurant kitchen — hood not exhausting properly", desc: "Kitchen getting smoky during peak hours. Possible grease buildup in exhaust duct.", cat: "SAFETY", pri: "CRITICAL", loc: 2, days: 5, status: "IN_PROGRESS" },
  { title: "Room 218 — TV not working, HDMI board failed", desc: "TV powers on but no picture. Maintenance found HDMI board failed.", cat: "MAINTENANCE", pri: "LOW", loc: 0, days: 3, status: "RESOLVED", resolved: { days: 0, method: "Replaced TV with spare unit from storage", rootCause: "TV HDMI board failure — unit was 6 years old", category: "Replaced", time: "under_1_hour", cost: 0 } },
  { title: "Guest complaint — noise from HVAC above room 204", desc: "Guest reported loud banging from ceiling HVAC at 2am. Room upgraded and HVAC flagged.", cat: "CUSTOMER_COMPLAINT", pri: "HIGH", loc: 0, days: 6, status: "RESOLVED", resolved: { days: 1, method: "Tightened ductwork hangers above 204; noise eliminated", rootCause: "Ductwork hanger vibrating loose — impacting structure during startup", category: "Repaired", time: "1_4_hours", cost: 0 } },
  { title: "Lobby fountain — pump motor seized", desc: "Lobby fountain pump not running. Water stagnant. Pump motor likely seized.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 0, days: 8, status: "RESOLVED", resolved: { days: 1, method: "Replaced pump motor and cleaned fountain basin", rootCause: "Pump ran dry when basin water level dropped below intake — motor burned", category: "Replaced", time: "4_8_hours", cost: 380 } },
  { title: "Conference center — projector bulb burned out", desc: "Main conference room projector won't display. Bulb burned out mid-presentation.", cat: "MAINTENANCE", pri: "HIGH", loc: 2, days: 2, status: "RESOLVED", resolved: { days: 0, method: "Replaced projector bulb with spare from storage", rootCause: "Bulb exceeded rated hours — replacement cycle needed", category: "Replaced", time: "under_1_hour", cost: 220 } },
  { title: "Vending machine — coin acceptor jammed Floor 3", desc: "Floor 3 vending machine coin slot jammed. Guest reported losing coins. Machine flagged.", cat: "MAINTENANCE", pri: "LOW", loc: 0, days: 10, status: "RESOLVED", resolved: { days: 1, method: "Cleared jammed coin mechanism; tested all denominations", rootCause: "Bent coin lodged in acceptance path", category: "Repaired", time: "under_1_hour", cost: 0 } },
  { title: "Room 102 — toilet not flushing — valve issue", desc: "Toilet fill valve not closing properly — constant running water.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 0, days: 7, status: "RESOLVED", resolved: { days: 0, method: "Replaced toilet fill valve and flapper", rootCause: "Fill valve seat worn — valve not seating fully", category: "Replaced", time: "under_1_hour", cost: 28 } },
  { title: "Parking structure — gate arm broken", desc: "Entry gate arm broken off. Parking uncontrolled until repair.", cat: "MAINTENANCE", pri: "HIGH", loc: 0, days: 12, status: "RESOLVED", resolved: { days: 1, method: "Replaced gate arm and sensor", rootCause: "Vehicle driver ignored gate signal and drove through", category: "Replaced", time: "4_8_hours", cost: 420 } },
  { title: "Kitchen refrigerator walk-in — door gasket torn", desc: "Walk-in cooler door gasket torn on top edge. Temperature fluctuating above 38°F. Food safety risk.", cat: "SAFETY", pri: "CRITICAL", loc: 2, days: 1, status: "RESOLVED", resolved: { days: 0, method: "Replaced door gasket; temperature back to 35°F", rootCause: "Gasket worn over time — not on regular inspection checklist", category: "Replaced", time: "under_1_hour", cost: 65 } },
  { title: "Laundry — washing machine 3 unbalanced, shutting off", desc: "Washer 3 going out of balance and stopping mid-cycle. Laundry backlog building.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 14, status: "RESOLVED", resolved: { days: 1, method: "Adjusted leveling feet and replaced worn suspension rods", rootCause: "Suspension rods fatigued — machine vibrating excessively", category: "Repaired", time: "4_8_hours", cost: 180 } },
  { title: "Ice machine — producing low volume, insufficient for F&B", desc: "Main ice machine output down 60%. F&B purchasing bagged ice to supplement.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 2, days: 16, status: "RESOLVED", resolved: { days: 2, method: "Cleaned condenser coils and descaled evaporator plates", rootCause: "Scale buildup on evaporator reducing ice production capacity", category: "Repaired", time: "1_2_days", cost: 240 } },
  { title: "Guest complaint — slow drain in room 512 shower", desc: "Guest reported standing water in shower. Drain partially blocked with hair/debris.", cat: "MAINTENANCE", pri: "LOW", loc: 0, days: 8, status: "RESOLVED", resolved: { days: 0, method: "Cleared drain using snake tool", rootCause: "Hair and debris accumulation in p-trap", category: "Repaired", time: "under_1_hour", cost: 0 } },
  { title: "Resort pool — chemical dosing pump failure", desc: "Pool chlorine level dropping. Automatic dosing pump failed. Manual dosing in use.", cat: "MAINTENANCE", pri: "HIGH", loc: 1, days: 20, status: "RESOLVED", resolved: { days: 1, method: "Replaced dosing pump diaphragm and recalibrated chemical feed", rootCause: "Pump diaphragm cracked from chemical exposure", category: "Replaced", time: "4_8_hours", cost: 310 }, sopIdx: 2, sopViolation: true, sopViolationNote: "Possible SOP Violation: Pool safety procedure § 4.1 requires verification of automated dosing pump function at each morning startup — a pump failure of this nature likely developed gradually and would have been caught by the required morning check" },
  { title: "Check-in kiosk — touchscreen unresponsive", desc: "Self check-in kiosk touchscreen frozen and not responding to taps. Guests queuing at desk.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 3, status: "RESOLVED", resolved: { days: 0, method: "Rebooted kiosk and updated touch driver firmware", rootCause: "Software update caused driver conflict; workaround applied", category: "Repaired", time: "under_1_hour", cost: 0 } },
  { title: "Gym — treadmill 3 belt slipping", desc: "Treadmill in hotel gym losing belt traction. Guest reported slipping at high speed.", cat: "SAFETY", pri: "HIGH", loc: 0, days: 6, status: "RESOLVED", resolved: { days: 0, method: "Tightened and re-lubricated belt; returned to service", rootCause: "Belt had stretched over time — not on regular adjustment schedule", category: "Adjusted/Calibrated", time: "under_1_hour", cost: 0 } },
  { title: "Exterior signage — 3 LED letters out on main sign", desc: "Three letters of hotel name sign dark. Affects brand visibility at night.", cat: "FACILITY", pri: "MEDIUM", loc: 0, days: 18, status: "RESOLVED", resolved: { days: 3, method: "Sign company replaced LED modules in 3 letter housings", rootCause: "LED driver boards failed — high heat from enclosure", category: "Replaced", time: "3_5_days", cost: 1400 } },
  { title: "Conference — sound system feedback at meeting", desc: "Audio feedback disrupted a corporate meeting in Conference B. Microphone system issue.", cat: "CUSTOMER_COMPLAINT", pri: "HIGH", loc: 2, days: 9, status: "RESOLVED", resolved: { days: 0, method: "Adjusted mixer EQ and repositioned speaker to reduce feedback loop", rootCause: "Microphone moved too close to speaker during room setup", category: "Adjusted/Calibrated", time: "under_1_hour", cost: 0 } },
  { title: "Breakfast buffet — warming oven temp low", desc: "Buffet warming oven only reaching 120°F instead of 165°F. Food safety concern. Food removed.", cat: "SAFETY", pri: "CRITICAL", loc: 2, days: 2, status: "RESOLVED", resolved: { days: 0, method: "Replaced oven heating element", rootCause: "Heating element failure — identified by thermocouple reading", category: "Replaced", time: "1_4_hours", cost: 145 }, sopIdx: 0, sopViolation: true, sopViolationNote: "Possible SOP Violation: Food temperature procedure § 3.1 requires pre-service temperature verification of all holding equipment — warming oven failure at 120°F suggests the pre-service check was not completed or equipment was not verified with a probe thermometer" },
  { title: "Spa — hydrotherapy jet pump tripping breaker", desc: "Jet pump tripping 30A breaker after 10 minutes. Spa jet pool offline.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 1, days: 25, status: "RESOLVED", resolved: { days: 2, method: "Replaced jet pump motor — bearing seized causing overload", rootCause: "Pump bearing seized from poor water chemistry causing accelerated wear", category: "Replaced", time: "1_2_days", cost: 1650 } },
  { title: "Room 325 — air conditioning dripping water on floor", desc: "HVAC unit condensate dripping from ceiling unit onto guest bed. Room taken out of service.", cat: "MAINTENANCE", pri: "HIGH", loc: 0, days: 30, status: "RESOLVED", resolved: { days: 0, method: "Cleared clogged condensate drain; wiped down ceiling area", rootCause: "Lint from previous maintenance blocked drain pan outlet", category: "Repaired", time: "under_1_hour", cost: 0 } },
  { title: "Roof — water intrusion around skylight after rain", desc: "Water dripping from skylight in lobby atrium during heavy rain. Buckets placed.", cat: "FACILITY", pri: "HIGH", loc: 0, days: 40, status: "RESOLVED", resolved: { days: 5, method: "Roofer resealed skylight perimeter with urethane caulk", rootCause: "Original sealant had dried and cracked after 12 years", category: "Vendor Resolved", time: "3_5_days", cost: 1900 } },
  { title: "Bar — POS terminal screen black, can't take orders", desc: "Bar POS terminal screen went black mid-service. Orders backed up.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 12, status: "RESOLVED", resolved: { days: 0, method: "Replaced power cable — connector corroded", rootCause: "Power connector had been bent repeatedly — contact corroded", category: "Replaced", time: "under_1_hour", cost: 18 } },
  { title: "Fitness center — elliptical 2 making grinding noise", desc: "Guest reported loud grinding from elliptical machine #2. Machine taken offline.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 0, days: 18, status: "RESOLVED", resolved: { days: 1, method: "Replaced flywheel bearing and applied lubricant to drive components", rootCause: "Flywheel bearing worn dry", category: "Replaced", time: "4_8_hours", cost: 95 } },
  { title: "Business center — printer paper jam, not clearing", desc: "Office printer in business center paper jammed and not clearing despite user resets.", cat: "MAINTENANCE", pri: "LOW", loc: 2, days: 4, status: "RESOLVED", resolved: { days: 0, method: "Cleared jam from paper path; cleaned rollers", rootCause: "Torn paper piece lodged in second paper path — not visible", category: "Repaired", time: "under_1_hour", cost: 0 } },
  { title: "Room 601 — balcony door difficult to open/close", desc: "Balcony door requires significant force to operate. Guest complained of effort required.", cat: "MAINTENANCE", pri: "LOW", loc: 0, days: 14, status: "RESOLVED", resolved: { days: 0, method: "Adjusted door frame alignment and lubricated hinges and track", rootCause: "Building settling shifted door frame slightly out of square", category: "Adjusted/Calibrated", time: "1_4_hours", cost: 0 } },
  { title: "Exterior — garden lighting shorting in rain", desc: "Exterior landscape lighting shorts during rain — breaker trips. Guests in dark near garden path.", cat: "SAFETY", pri: "HIGH", loc: 1, days: 45, status: "RESOLVED", resolved: { days: 3, method: "Replaced outdoor light fixtures with IP65-rated waterproof units", rootCause: "Non-waterproof fixtures installed in outdoor application — water ingress caused shorts", category: "Replaced", time: "3_5_days", cost: 1100 } },
  { title: "Bar tap — handle loose, CO2 pressure uneven", desc: "Draft beer tap 4 handle loose and CO2 pressure inconsistent. Pours foamy.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 0, days: 7, status: "RESOLVED", resolved: { days: 0, method: "Tightened faucet coupling and adjusted CO2 regulator to 12 PSI", rootCause: "Faucet coupling backed off over time from repeated use", category: "Adjusted/Calibrated", time: "under_1_hour", cost: 0 } },
]

// ─── Generic issue data (used for retail, property, education, restaurants, multisite, other) ──

function genericIssues(companyType: string): IssueSeed[] {
  return [
    // Recurring: Primary asset (asset 0)
    { title: `${companyType} HVAC Unit A — failing to reach target temp`, desc: "Unit A has not been maintaining set temperature reliably for the last 2 weeks. Service call pending.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 0, days: 4, status: "OPEN", asset: 0 },
    { title: `${companyType} HVAC Unit A — refrigerant low`, desc: "HVAC showing signs of low refrigerant. Cooling capacity reduced by ~40%.", cat: "MAINTENANCE", pri: "HIGH", loc: 0, days: 25, status: "RESOLVED", asset: 0, resolved: { days: 2, method: "Recharged refrigerant and found/sealed small leak", rootCause: "Pin-hole leak in evaporator coil tubing", category: "Repaired", time: "4_8_hours", cost: 680 } },
    { title: `${companyType} HVAC Unit A — drain pan overflowing`, desc: "Condensate drain pan overflowing. Water dripping from ceiling in occupied area.", cat: "MAINTENANCE", pri: "HIGH", loc: 0, days: 65, status: "RESOLVED", asset: 0, resolved: { days: 0, method: "Cleared drain line and treated with biocide", rootCause: "Algae blockage in condensate drain", category: "Repaired", time: "under_1_hour", cost: 20 } },
    { title: `${companyType} HVAC Unit A — squealing on startup`, desc: "Belt squeal on every startup. Getting worse. Belt replacement overdue.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 0, days: 100, status: "RESOLVED", asset: 0, resolved: { days: 1, method: "Replaced blower belt and adjusted tension", rootCause: "Belt stretched beyond adjustment range", category: "Replaced", time: "4_8_hours", cost: 65 } },
    { title: `${companyType} HVAC Unit A — thermostat sensor failed`, desc: "Thermostat showing wrong temperature. Sensor failed.", cat: "EQUIPMENT_BREAKDOWN", pri: "MEDIUM", loc: 0, days: 140, status: "RESOLVED", asset: 0, resolved: { days: 1, method: "Replaced temperature sensor", rootCause: "Sensor end-of-life failure after 8 years", category: "Replaced", time: "4_8_hours", cost: 120 } },

    // Escalated
    { title: "Critical equipment failure — operations impacted", desc: "Primary equipment offline. Operations severely impacted. Escalated to management.", cat: "EQUIPMENT_BREAKDOWN", pri: "CRITICAL", loc: 0, days: 2, status: "OPEN", escalated: true, lvl: 2 },

    // Maintenance
    { title: "Plumbing — sink drain blocked in staff restroom", desc: "Staff restroom sink fully blocked. Water backing up.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 0, days: 2, status: "RESOLVED", resolved: { days: 0, method: "Cleared drain with snake", rootCause: "Debris accumulation in P-trap", category: "Repaired", time: "under_1_hour", cost: 0 } },
    { title: "Lighting — 4 overhead fixtures not working", desc: "Four ceiling lights out in main area. Visibility reduced.", cat: "FACILITY", pri: "MEDIUM", loc: 0, days: 5, status: "RESOLVED", resolved: { days: 1, method: "Replaced LED lamps and one ballast", rootCause: "End-of-life LED failure; one ballast failed", category: "Replaced", time: "4_8_hours", cost: 85 } },
    { title: "Front entrance — door closer not working", desc: "Main entrance door not closing fully. Security and climate control concern.", cat: "MAINTENANCE", pri: "HIGH", loc: 0, days: 3, status: "RESOLVED", resolved: { days: 0, method: "Replaced door closer spring assembly", rootCause: "Door closer spring fatigued after daily use over 5 years", category: "Replaced", time: "under_1_hour", cost: 75 } },
    { title: "Parking area — pothole near entrance gate", desc: "Large pothole near main entrance. Vehicle damage risk.", cat: "FACILITY", pri: "MEDIUM", loc: 0, days: 10, status: "OPEN" },
    { title: "Electrical — outlet in back office not working", desc: "Two outlets in back office have no power. GFI may have tripped.", cat: "FACILITY", pri: "LOW", loc: 0, days: 4, status: "RESOLVED", resolved: { days: 0, method: "Reset GFCI breaker in nearby bathroom", rootCause: "GFCI had tripped without being noticed", category: "Repaired", time: "under_1_hour", cost: 0 } },
    { title: "Roof — active leak over storage area", desc: "Water leak from roof during last rain event. Inventory at risk.", cat: "FACILITY", pri: "HIGH", loc: 0, days: 15, status: "RESOLVED", resolved: { days: 5, method: "Roofer patched damaged membrane section", rootCause: "Membrane crack from weather cycling", category: "Vendor Resolved", time: "3_5_days", cost: 1800 } },
    { title: "Fire suppression system — monthly check skipped", desc: "Monthly fire suppression check was not completed this month.", cat: "SAFETY", pri: "HIGH", loc: 0, days: 8, status: "RESOLVED", resolved: { days: 0, method: "Completed inspection immediately", rootCause: "Inspection not assigned after last responsible person left", category: "Training/Process Fix", time: "under_1_hour", cost: 0 }, sopIdx: 0, sopViolation: true, sopViolationNote: "Possible SOP Violation: Fire safety procedure § 2.6 requires monthly inspection completion and documentation by the 5th of each month — this month's inspection was not completed or documented" },
    { title: "Water heater — tepid water in morning", desc: "Water temperature inadequate before 9am. Heater recovery time too slow.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 1, days: 20, status: "RESOLVED", resolved: { days: 2, method: "Replaced heating element and thermostat", rootCause: "Heating element degraded to 30% efficiency", category: "Replaced", time: "4_8_hours", cost: 280 } },
    { title: "Pest control — ant trail found in kitchen area", desc: "Ant trail discovered in kitchen/break room area. Immediate pest control needed.", cat: "SAFETY", pri: "HIGH", loc: 0, days: 6, status: "RESOLVED", resolved: { days: 1, method: "Pest control applied bait and sealed entry points", rootCause: "Gap under exterior door provided entry", category: "Vendor Resolved", time: "1_2_days", cost: 220 } },
    { title: "Safety — first aid kit expired contents", desc: "First aid kit contents expired in main location. Must be restocked.", cat: "SAFETY", pri: "MEDIUM", loc: 0, days: 12, status: "RESOLVED", resolved: { days: 0, method: "Replaced all expired items; added to quarterly check list", rootCause: "No regular inspection schedule for first aid supplies", category: "Training/Process Fix", time: "under_1_hour", cost: 45 } },
    { title: "Equipment — primary unit making unusual noise", desc: "Key equipment producing grinding sound. May indicate bearing failure.", cat: "EQUIPMENT_BREAKDOWN", pri: "HIGH", loc: 1, days: 3, status: "IN_PROGRESS" },
    { title: "HVAC — office area not cooling in afternoon", desc: "Office temperature rising above 78°F in afternoon despite AC running.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 2, days: 7, status: "IN_PROGRESS" },
    { title: "Security camera — angle 3 offline", desc: "Camera on northwest corner showing black. Network or hardware failure.", cat: "FACILITY", pri: "HIGH", loc: 0, days: 9, status: "RESOLVED", resolved: { days: 1, method: "Replaced camera and reset PoE switch port", rootCause: "Camera had been struck by vehicle", category: "Replaced", time: "4_8_hours", cost: 340 } },
    { title: "Generator — annual load test not completed", desc: "Annual generator load test due last month. Must be done before insurance audit.", cat: "SAFETY", pri: "MEDIUM", loc: 0, days: 35, status: "RESOLVED", resolved: { days: 1, method: "Load test completed; generator performed within spec", rootCause: "Annual test not scheduled in maintenance calendar", category: "Training/Process Fix", time: "4_8_hours", cost: 0 } },
    { title: "Customer complaint — recurring issue reported", desc: "Customer submitted complaint about recurring problem. Third time in 60 days.", cat: "CUSTOMER_COMPLAINT", pri: "HIGH", loc: 0, days: 4, status: "IN_PROGRESS" },
    { title: "Signage — exterior sign damaged by weather", desc: "Main exterior sign panel cracked after storm. Aesthetics and branding affected.", cat: "FACILITY", pri: "MEDIUM", loc: 0, days: 18, status: "RESOLVED", resolved: { days: 5, method: "Sign company replaced damaged panel", rootCause: "Panel not rated for high-wind conditions in this area", category: "Replaced", time: "3_5_days", cost: 900 } },
    { title: "Supplies — critical items out of stock", desc: "Key operational supplies depleted. Workflow disrupted until restocked.", cat: "GENERAL", pri: "HIGH", loc: 0, days: 1, status: "OPEN" },
    { title: "Flooring — section cracked/damaged creating trip hazard", desc: "Damaged floor section in main traffic area. Slip/trip risk.", cat: "SAFETY", pri: "HIGH", loc: 0, days: 5, status: "RESOLVED", resolved: { days: 2, method: "Repaired floor section with appropriate filler and finish", rootCause: "Impact damage from equipment movement", category: "Repaired", time: "1_2_days", cost: 580 } },
    { title: "Lock — back door deadbolt difficult to operate", desc: "Back exit door deadbolt stiff and requiring excessive force. Fire egress concern.", cat: "SAFETY", pri: "HIGH", loc: 0, days: 3, status: "RESOLVED", resolved: { days: 0, method: "Replaced deadbolt assembly", rootCause: "Lock cylinder worn", category: "Replaced", time: "under_1_hour", cost: 55 } },
    { title: "Restroom — toilet not flushing properly", desc: "Restroom toilet not fully clearing on flush. Guests/staff reported issue.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 1, days: 6, status: "RESOLVED", resolved: { days: 0, method: "Replaced flapper and adjusted flush handle", rootCause: "Flapper warped from age", category: "Replaced", time: "under_1_hour", cost: 15 } },
    { title: "Break room — microwave stopped heating", desc: "Staff break room microwave running but not producing heat. Likely magnetron failure.", cat: "MAINTENANCE", pri: "LOW", loc: 2, days: 10, status: "RESOLVED", resolved: { days: 1, method: "Replaced microwave unit", rootCause: "Magnetron failure — 8-year-old unit, not worth repair", category: "Replaced", time: "under_1_hour", cost: 95 } },
    { title: "Internet — intermittent outages affecting operations", desc: "Internet drops 3–4 times per day for 2–5 minutes each. ISP ticket opened.", cat: "FACILITY", pri: "HIGH", loc: 0, days: 8, status: "IN_PROGRESS" },
    { title: "Equipment preventive maintenance overdue", desc: "Several pieces of equipment are past their scheduled PM date.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 1, days: 14, status: "OPEN" },
    { title: "Safety — eye wash station needs inspection", desc: "Eye wash station not tested in 90 days. Requires weekly activation per OSHA.", cat: "SAFETY", pri: "HIGH", loc: 0, days: 20, status: "RESOLVED", resolved: { days: 0, method: "Flushed eye wash station; added to weekly checklist", rootCause: "Weekly check not being performed consistently", category: "Training/Process Fix", time: "under_1_hour", cost: 0 }, sopIdx: 0, sopViolation: true, sopViolationNote: "Possible SOP Violation: Fire and life safety inspection procedure § 2.1 requires monthly documented inspection of safety equipment — eye wash station had not been activated or logged for 90 days" },
    { title: "Parking — lighting insufficient in evening hours", desc: "Parking area too dark after sunset. Safety concern for staff and visitors.", cat: "FACILITY", pri: "MEDIUM", loc: 0, days: 25, status: "RESOLVED", resolved: { days: 3, method: "Added 2 additional light poles with LED fixtures", rootCause: "Original lighting design insufficient for current usage", category: "Repaired", time: "3_5_days", cost: 2200 } },
    { title: "HVAC filter — not changed on schedule", desc: "HVAC filters due for replacement 3 weeks ago. Airflow restricted, efficiency dropping.", cat: "MAINTENANCE", pri: "LOW", loc: 2, days: 22, status: "RESOLVED", resolved: { days: 0, method: "Replaced all filters; documented in PM log", rootCause: "Maintenance schedule reminder not set up in new system", category: "Training/Process Fix", time: "under_1_hour", cost: 35 } },
    { title: "Electrical — GFI outlet tripping in wet area", desc: "GFI outlet near sink tripping repeatedly. Possible moisture intrusion into outlet box.", cat: "SAFETY", pri: "HIGH", loc: 1, days: 16, status: "RESOLVED", resolved: { days: 1, method: "Replaced outlet with weather-resistant unit; sealed conduit entry", rootCause: "Water infiltrating conduit due to broken seal at outdoor entry point", category: "Replaced", time: "4_8_hours", cost: 135 } },
    { title: "Vendor issue — scheduled service not completed", desc: "Scheduled maintenance vendor did not arrive. Contract service missed.", cat: "GENERAL", pri: "MEDIUM", loc: 0, days: 30, status: "RESOLVED", resolved: { days: 1, method: "Rescheduled with vendor; service completed next day", rootCause: "Vendor scheduling error on their end", category: "Vendor Resolved", time: "1_2_days", cost: 0 } },
    { title: "Customer complaint — unresolved from previous month", desc: "Customer complaint from prior month still open. Customer following up with management.", cat: "CUSTOMER_COMPLAINT", pri: "HIGH", loc: 0, days: 32, status: "RESOLVED", resolved: { days: 1, method: "Resolved customer concern; process change implemented", rootCause: "Issue fell through handoff between team members", category: "Training/Process Fix", time: "1_4_hours", cost: 0 } },
    { title: "Equipment — lubrication service overdue", desc: "Key moving equipment not lubricated per schedule. Unusual noise noticed.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 1, days: 45, status: "RESOLVED", resolved: { days: 0, method: "Lubricated all equipment per PM spec", rootCause: "PM schedule not followed due to busy period", category: "Training/Process Fix", time: "1_4_hours", cost: 20 } },
    { title: "Janitorial — floor scrubber battery not holding charge", desc: "Auto floor scrubber battery depleted after 45 minutes instead of 4 hours.", cat: "MAINTENANCE", pri: "MEDIUM", loc: 0, days: 50, status: "RESOLVED", resolved: { days: 2, method: "Replaced battery pack", rootCause: "Battery cells at end of 5-year service life", category: "Replaced", time: "1_2_days", cost: 380 } },
    { title: "HVAC — zone 2 damper not opening", desc: "Zone 2 HVAC damper stuck closed. Area not being conditioned.", cat: "MAINTENANCE", pri: "HIGH", loc: 1, days: 55, status: "RESOLVED", resolved: { days: 2, method: "Replaced actuator and repositioned damper blade", rootCause: "Actuator failed in closed position", category: "Replaced", time: "4_8_hours", cost: 220 } },
    { title: "Safety — carbon monoxide detector alarm triggered", desc: "CO detector alarm in attached garage area triggered. Area evacuated briefly.", cat: "SAFETY", pri: "CRITICAL", loc: 0, days: 60, status: "RESOLVED", resolved: { days: 0, method: "Identified gas-powered equipment left idling in enclosed area; area ventilated", rootCause: "Equipment left running in enclosed space without ventilation", category: "Training/Process Fix", time: "under_1_hour", cost: 0 } },
    { title: "Supply — vendor delivery delayed, critical shortage imminent", desc: "Key supply vendor delayed delivery. Stock will run out by end of week.", cat: "GENERAL", pri: "HIGH", loc: 0, days: 3, status: "IN_PROGRESS" },
    { title: "Plumbing — hot water heater temp fluctuating", desc: "Hot water temperature varying widely — scalding risk in some fixtures.", cat: "SAFETY", pri: "HIGH", loc: 1, days: 70, status: "RESOLVED", resolved: { days: 1, method: "Replaced tempering valve on water heater outlet", rootCause: "Tempering valve failed to maintain consistent mix temperature", category: "Replaced", time: "4_8_hours", cost: 145 } },
    { title: "Pest — fruit fly infestation in break room", desc: "Fruit fly infestation in break room. Drain cleaning and pest treatment needed.", cat: "SAFETY", pri: "MEDIUM", loc: 2, days: 12, status: "RESOLVED", resolved: { days: 2, method: "Cleaned all drains with enzyme treatment; placed fly traps", rootCause: "Organic matter in drain lines providing breeding ground", category: "Repaired", time: "1_2_days", cost: 80 } },
    { title: "Electrical — panel label inaccurate after renovation", desc: "Panel breaker labels don't match actual circuits after recent work. Safety hazard.", cat: "SAFETY", pri: "HIGH", loc: 0, days: 80, status: "RESOLVED", resolved: { days: 1, method: "Electrician traced and relabeled all circuits", rootCause: "Renovation team did not update panel schedule", category: "Training/Process Fix", time: "4_8_hours", cost: 250 } },
    { title: "Roof access — ladder not secured per code", desc: "Roof access ladder improperly secured. Fall hazard if used.", cat: "SAFETY", pri: "HIGH", loc: 0, days: 90, status: "RESOLVED", resolved: { days: 1, method: "Properly anchored ladder per building code requirements", rootCause: "Ladder installed by contractor without proper anchor hardware", category: "Repaired", time: "4_8_hours", cost: 65 } },
    { title: "Ventilation — bathroom exhaust fan not working", desc: "Staff restroom exhaust fan not running. Odor buildup and humidity concern.", cat: "MAINTENANCE", pri: "LOW", loc: 2, days: 15, status: "RESOLVED", resolved: { days: 0, method: "Replaced exhaust fan motor", rootCause: "Motor failure — unit was 11 years old", category: "Replaced", time: "1_4_hours", cost: 55 } },
  ]
}

// ─── Issue map by industry key ─────────────────────────────────────────────

function getIssueSeeds(industryKey: string): IssueSeed[] {
  switch (industryKey) {
    case "manufacturing": return MFG_ISSUES
    case "warehousing":   return WH_ISSUES
    case "hospitality":   return HOSP_ISSUES
    default:              return genericIssues(getTemplate(
      INDUSTRY_TEMPLATES.find(t => t.key === industryKey)?.label ?? "Operations"
    ).demoCompanyName.split(" ")[0])
  }
}

// ─── Asset seeds per industry ──────────────────────────────────────────────

interface AssetSeed {
  name: string
  type: "EQUIPMENT" | "VEHICLE" | "FACILITY" | "TOOL" | "IT"
  status: "OPERATIONAL" | "NEEDS_MAINTENANCE" | "OUT_OF_SERVICE"
  locIdx: number
}

function getAssets(industryKey: string): AssetSeed[] {
  switch (industryKey) {
    case "manufacturing":
      return [
        { name: "Conveyor Belt Line 3",       type: "EQUIPMENT", status: "NEEDS_MAINTENANCE", locIdx: 0 },
        { name: "Hydraulic Press Station 4",   type: "EQUIPMENT", status: "NEEDS_MAINTENANCE", locIdx: 0 },
        { name: "CNC Machine Center #2",       type: "EQUIPMENT", status: "OPERATIONAL",       locIdx: 0 },
        { name: "Air Compressor System",       type: "EQUIPMENT", status: "OPERATIONAL",       locIdx: 0 },
        { name: "Forklift Unit B",             type: "VEHICLE",   status: "OPERATIONAL",       locIdx: 1 },
        { name: "HVAC Unit — Plant Building",  type: "EQUIPMENT", status: "NEEDS_MAINTENANCE", locIdx: 0 },
        { name: "Company Van #2",              type: "VEHICLE",   status: "NEEDS_MAINTENANCE", locIdx: 2 },
      ]
    case "warehousing":
      return [
        { name: "Dock Door 7",               type: "FACILITY", status: "NEEDS_MAINTENANCE", locIdx: 0 },
        { name: "Forklift #3",               type: "VEHICLE",  status: "OUT_OF_SERVICE",    locIdx: 0 },
        { name: "Conveyor Sorter Line A",    type: "EQUIPMENT", status: "OPERATIONAL",      locIdx: 0 },
        { name: "Stretch Wrap Machine",      type: "EQUIPMENT", status: "OPERATIONAL",      locIdx: 1 },
        { name: "Electric Pallet Jack #2",   type: "VEHICLE",  status: "NEEDS_MAINTENANCE", locIdx: 0 },
      ]
    case "hospitality":
      return [
        { name: "HVAC Unit — Room Block C",   type: "EQUIPMENT", status: "NEEDS_MAINTENANCE", locIdx: 0 },
        { name: "Main Elevator",              type: "EQUIPMENT", status: "OUT_OF_SERVICE",    locIdx: 0 },
        { name: "Pool Heater System",         type: "EQUIPMENT", status: "NEEDS_MAINTENANCE", locIdx: 1 },
        { name: "Kitchen Exhaust Hood",       type: "EQUIPMENT", status: "NEEDS_MAINTENANCE", locIdx: 2 },
        { name: "Ice Machine — Main Kitchen", type: "EQUIPMENT", status: "OPERATIONAL",       locIdx: 2 },
      ]
    default:
      return [
        { name: "HVAC Unit A",              type: "EQUIPMENT", status: "NEEDS_MAINTENANCE", locIdx: 0 },
        { name: "Primary Equipment Unit",   type: "EQUIPMENT", status: "OPERATIONAL",       locIdx: 0 },
        { name: "Secondary Equipment Unit", type: "EQUIPMENT", status: "OPERATIONAL",       locIdx: 1 },
        { name: "Service Vehicle",          type: "VEHICLE",   status: "OPERATIONAL",       locIdx: 0 },
      ]
  }
}

// ─── Main: create + reset ─────────────────────────────────────────────────────

export type DemoPackage = "essentials" | "professional" | "professional_plus"

const PACKAGE_PLAN: Record<DemoPackage, string> = {
  essentials:        "essentials",
  professional:      "pro",
  professional_plus: "professional_plus",
}

export async function createDemoOrg(industry?: string, pkg: DemoPackage = "professional") {
  const industryLabel = industry ?? DEFAULT_INDUSTRY
  const template      = getTemplate(industryLabel)
  const slug          = `${DEMO_SLUG_PREFIX}${Math.random().toString(36).slice(2, 10)}`
  const expiresAt     = new Date(Date.now() + DEMO_TTL_MS)
  const isPlusOrAbove = pkg === "professional_plus"

  const org = await prisma.organization.create({
    data: {
      name:                   template.demoCompanyName,
      slug,
      industry:               industryLabel,
      isDemo:                 true,
      demoExpiresAt:          expiresAt,
      onboardingCompletedAt:  new Date(),
      subscriptionStatus:     "active",
      plan:                   PACKAGE_PLAN[pkg],
      aiSuggestionsAvailable: true,
      purchaseRequestEnabled: true,
      companySize:            "250",
      // Feature flags — enabled for Professional Plus+
      regions_enabled:                  isPlusOrAbove,
      corporate_dashboard_enabled:      isPlusOrAbove,
      cross_location_analytics_enabled: isPlusOrAbove,
      advanced_escalations_enabled:     isPlusOrAbove,
      api_webhooks_enabled:             isPlusOrAbove,
      sso_foundation_enabled:           isPlusOrAbove,
      shared_facility_enabled:          isPlusOrAbove,
      executive_briefings_enabled:      isPlusOrAbove,
      health_scores_enabled:            isPlusOrAbove,
      trend_detection_enabled:          isPlusOrAbove,
      executive_goals_enabled:          isPlusOrAbove,
    },
  })

  const passwordHash = await bcrypt.hash(Math.random().toString(36), 10)
  const user = await prisma.user.create({
    data: {
      email:          `admin@${slug}.demo`,
      name:           "Demo Admin",
      password:       passwordHash,
      role:           "ADMIN",
      organizationId: org.id,
      isActive:       true,
    },
  })

  await seedDemoContent(org.id, user.id, industryLabel, slug)
  if (isPlusOrAbove) {
    await seedPlusDemoContent(org.id, user.id)
  }
  await setWorkforceCommsPlanFlags(org.id, PACKAGE_PLAN[pkg])
  return { org, user }
}

export async function resetDemoOrg(orgId: string, adminUserId: string, industry?: string, pkg: DemoPackage = "professional_plus") {
  // Get current industry + slug — slug needed to mint unique emails per demo session
  let industryLabel = industry
  let slug = ""
  const orgRecord = await prisma.organization.findUnique({ where: { id: orgId }, select: { industry: true, slug: true } })
  if (!industryLabel) industryLabel = orgRecord?.industry ?? DEFAULT_INDUSTRY
  slug = orgRecord?.slug ?? `demo-${Math.random().toString(36).slice(2, 10)}`
  const template      = getTemplate(industryLabel)
  const isPlusOrAbove = pkg === "professional_plus"

  // ── Delete Plus-specific content first ───────────────────────────────────
  await Promise.all([
    prisma.qrCodeSubmission.deleteMany({ where: { qrCode: { organizationId: orgId } } }),
    prisma.goalProgress.deleteMany({ where: { goal: { organizationId: orgId } } }),
  ])
  await Promise.all([
    prisma.qrCode.deleteMany({ where: { organizationId: orgId } }),
    prisma.executiveGoal.deleteMany({ where: { organizationId: orgId } }),
    prisma.executiveBriefing.deleteMany({ where: { organizationId: orgId } }),
    prisma.healthScore.deleteMany({ where: { organizationId: orgId } }),
    prisma.trendAlert.deleteMany({ where: { organizationId: orgId } }),
    prisma.apiKey.deleteMany({ where: { organizationId: orgId } }),
    prisma.webhookEndpoint.deleteMany({ where: { organizationId: orgId } }),
    prisma.organizationRelationship.deleteMany({ where: { orgIdA: orgId } }),
    prisma.analyticsSnapshot.deleteMany({ where: { organizationId: orgId } }),
  ])
  await prisma.escalationChainStep.deleteMany({ where: { chain: { organizationId: orgId } } })
  await prisma.escalationChain.deleteMany({ where: { organizationId: orgId } })

  // ── Delete all base content (order matters for FK constraints) ───────────
  await Promise.all([
    prisma.issueComment.deleteMany({ where: { issue: { organizationId: orgId } } }),
    prisma.issueHistory.deleteMany({ where: { issue: { organizationId: orgId } } }),
    prisma.issueEscalation.deleteMany({ where: { issue: { organizationId: orgId } } }),
    prisma.notification.deleteMany({ where: { organizationId: orgId } }),
    prisma.suggestion.deleteMany({ where: { organizationId: orgId } }),
    prisma.attachment.deleteMany({ where: { issue: { organizationId: orgId } } }),
    prisma.injuryReport.deleteMany({ where: { organizationId: orgId } }),
    prisma.purchaseRequest.deleteMany({ where: { organizationId: orgId } }),
  ])
  await Promise.all([
    prisma.assignment.deleteMany({ where: { orgId: orgId } }),
    prisma.announcement.deleteMany({ where: { orgId: orgId } }),
    prisma.emergencyBroadcast.deleteMany({ where: { orgId: orgId } }),
  ])
  await prisma.issue.deleteMany({ where: { organizationId: orgId } })
  await Promise.all([
    prisma.sOP.deleteMany({ where: { organizationId: orgId } }),
    prisma.asset.deleteMany({ where: { organizationId: orgId } }),
    prisma.vendor.deleteMany({ where: { organizationId: orgId } }),
    prisma.employeeType.deleteMany({ where: { organizationId: orgId } }),
    prisma.routingRule.deleteMany({ where: { organizationId: orgId } }),
  ])
  await prisma.department.deleteMany({ where: { organizationId: orgId } })
  // Locations reference regions (regionId FK) — delete locations first, then regions
  await prisma.location.deleteMany({ where: { organizationId: orgId } })
  // Delete non-admin users (may have regionId FK — delete before regions)
  await prisma.user.deleteMany({ where: { organizationId: orgId, id: { not: adminUserId } } })
  // Regions are safe to delete once all locations and users are gone
  await prisma.region.deleteMany({ where: { organizationId: orgId } })

  // ── Update org: reset plan and feature flags ──────────────────────────────
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      name:                             template.demoCompanyName,
      industry:                         industryLabel,
      companySize:                      "250",
      plan:                             PACKAGE_PLAN[pkg],
      regions_enabled:                  isPlusOrAbove,
      corporate_dashboard_enabled:      isPlusOrAbove,
      cross_location_analytics_enabled: isPlusOrAbove,
      advanced_escalations_enabled:     isPlusOrAbove,
      api_webhooks_enabled:             isPlusOrAbove,
      sso_foundation_enabled:           isPlusOrAbove,
      shared_facility_enabled:          isPlusOrAbove,
      executive_briefings_enabled:      isPlusOrAbove,
      health_scores_enabled:            isPlusOrAbove,
      trend_detection_enabled:          isPlusOrAbove,
      executive_goals_enabled:          isPlusOrAbove,
    },
  })

  await seedDemoContent(orgId, adminUserId, industryLabel, slug)
  if (isPlusOrAbove) {
    await seedPlusDemoContent(orgId, adminUserId)
  }
  await setWorkforceCommsPlanFlags(orgId, PACKAGE_PLAN[pkg])
}

// ─── Seed content ─────────────────────────────────────────────────────────────

async function seedDemoContent(orgId: string, adminUserId: string, industryLabel: string, slug: string) {
  const template   = getTemplate(industryLabel)
  const industryKey = template.key
  const ago         = (days: number, extraMs = 0) =>
    new Date(Date.now() - days * 86400000 + extraMs)

  // ── Employee type presets ─────────────────────────────────────────────────
  const dummyHash = await bcrypt.hash("demo-placeholder", 6)

  await prisma.employeeType.createMany({
    data: EMPLOYEE_TYPE_PRESETS.map(p => ({
      organizationId: orgId,
      name:           p.name,
      description:    p.description,
      baseRole:       p.baseRole,
      pageAccess:     p.pageAccess as unknown as string[],
      actions:        p.actions as unknown as string[],
      canInvite:      p.canInvite,
      canChangeEmail: p.canChangeEmail,
      isPreset:       true,
      presetKey:      p.key,
    })),
    skipDuplicates: true,
  })

  // ── Locations ─────────────────────────────────────────────────────────────
  const locationRecords = await Promise.all(
    template.demoLocations.map(l =>
      prisma.location.create({
        data: { name: l.name, locationType: l.locationType, organizationId: orgId, isActive: true },
      })
    )
  )
  const locationIds = locationRecords.map(l => l.id)

  // ── Departments ───────────────────────────────────────────────────────────
  const deptRecords = await Promise.all(
    template.departments.map(name =>
      prisma.department.create({ data: { name, organizationId: orgId } })
    )
  )
  const deptIds = deptRecords.map(d => d.id)

  // ── Vendors ───────────────────────────────────────────────────────────────
  const vendorRecords = await Promise.all(
    template.demoVendors.map(v =>
      prisma.vendor.create({ data: { name: v.name, specialty: v.specialty, organizationId: orgId, isActive: true } })
    )
  )
  const primaryVendorId = vendorRecords[0]?.id

  // ── Demo users ────────────────────────────────────────────────────────────
  const userRecords = await Promise.all(
    DEMO_USERS.map(u => {
      const deptId = deptIds[u.deptIdx % deptIds.length]
      return prisma.user.create({
        data: {
          email:          `${u.name.toLowerCase().replace(/\s+/g, ".")}@${slug}.demo`,
          name:           u.name,
          password:       dummyHash,
          role:           u.role,
          organizationId: orgId,
          departmentId:   deptId,
          isActive:       true,
        },
      })
    })
  )
  const allUserIds   = [adminUserId, ...userRecords.map(u => u.id)]
  const managerIds   = [adminUserId, ...userRecords.filter(u => u.role === "MANAGER").map(u => u.id)]
  const techIds      = [...userRecords.filter(u => u.role === "EMPLOYEE").map(u => u.id)]
  const assigneeIds  = [...techIds, ...userRecords.filter(u => u.role === "SUPERVISOR").map(u => u.id)]

  // ── Assets ────────────────────────────────────────────────────────────────
  const assetSeeds  = getAssets(industryKey)
  const assetRecords = await Promise.all(
    assetSeeds.map(a =>
      prisma.asset.create({
        data: {
          name:           a.name,
          type:           a.type,
          status:         a.status,
          locationId:     locationIds[a.locIdx] ?? locationIds[0],
          organizationId: orgId,
        },
      })
    )
  )
  const assetIds = assetRecords.map(a => a.id)

  // ── SOPs ──────────────────────────────────────────────────────────────────
  const { parseSOPSections } = await import("@/lib/sop-matching")
  const sopRecords = await Promise.all(
    template.demoSOPs.map(sop => {
      const sections = parseSOPSections(sop.content)
      return prisma.sOP.create({
        data: {
          organizationId: orgId,
          title:          sop.title,
          description:    sop.description,
          category:       sop.category,
          assetType:      sop.assetType,
          version:        sop.version,
          content:        sop.content,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sections:       sections.length > 0 ? (sections as any) : undefined,
          isActive:       true,
        },
      })
    })
  )
  const sopIds = sopRecords.map(s => s.id)

  // ── Issues ────────────────────────────────────────────────────────────────
  const issueSeeds = getIssueSeeds(industryKey)

  // Build the bulk insert array
  const escalatedSeed = issueSeeds.find(s => s.escalated)
  const regularSeeds  = issueSeeds.filter(s => !s.escalated)

  // Bulk create regular issues
  const issueData = regularSeeds.map((s, i) => {
    const reporterId = allUserIds[i % allUserIds.length]
    const assigneeId = s.status && s.status !== "OPEN"
      ? assigneeIds[i % assigneeIds.length]
      : i % 4 !== 0 ? assigneeIds[i % assigneeIds.length] : null

    const createdAt  = ago(s.days)
    let   resolvedAt: Date | undefined
    let   resolvedFields: object = {}

    if (s.status === "RESOLVED" && s.resolved) {
      resolvedAt    = ago(s.days - s.resolved.days)
      resolvedFields = {
        resolvedAt,
        resolvedMethod:     s.resolved.method,
        rootCause:          s.resolved.rootCause ?? null,
        resolutionCategory: s.resolved.category  ?? null,
        timeToResolve:      s.resolved.time       ?? null,
        resolutionCost:     s.resolved.cost        ?? null,
      }
    }

    const autoStatus = s.status ?? (
      i % 5 === 0 ? "IN_PROGRESS" :
      i % 3 === 0 ? "RESOLVED"    : "OPEN"
    )

    const sopFields = s.sopIdx !== undefined && sopIds[s.sopIdx]
      ? {
          sopId:            sopIds[s.sopIdx],
          sopViolation:     s.sopViolation ?? false,
          sopViolationNote: s.sopViolationNote ?? null,
          sopMatchConfidence: 0.82 + (i % 10) * 0.01,  // realistic-looking AI confidence
          sopLinkSource:    "AI",
        }
      : {}

    return {
      title:          s.title,
      description:    s.desc,
      status:         autoStatus,
      priority:       s.pri,
      category:       s.cat,
      organizationId: orgId,
      reportedById:   reporterId,
      assignedToId:   assigneeId ?? managerIds[0],
      locationId:     locationIds[s.loc] ?? locationIds[0],
      assetId:        s.asset !== undefined ? (assetIds[s.asset] ?? null) : null,
      vendorId:       s.asset !== undefined && i % 5 === 0 ? primaryVendorId : null,
      isEscalated:    false,
      escalationLevel:0,
      createdAt,
      ...resolvedFields,
      ...sopFields,
    }
  })

  await prisma.issue.createMany({ data: issueData })

  // ── Escalated issue (needs separate create + escalation record) ──────────
  if (escalatedSeed) {
    const escReporter  = allUserIds[0]
    const escAssignee  = managerIds[0]
    const escCreatedAt = ago(escalatedSeed.days)

    const escSopFields = escalatedSeed.sopIdx !== undefined && sopIds[escalatedSeed.sopIdx]
      ? {
          sopId:              sopIds[escalatedSeed.sopIdx],
          sopViolation:       escalatedSeed.sopViolation ?? false,
          sopViolationNote:   escalatedSeed.sopViolationNote ?? null,
          sopMatchConfidence: 0.87,
          sopLinkSource:      "AI",
        }
      : {}

    const escIssue = await prisma.issue.create({
      data: {
        title:          escalatedSeed.title,
        description:    escalatedSeed.desc,
        status:         "OPEN",
        priority:       "CRITICAL",
        category:       escalatedSeed.cat,
        organizationId: orgId,
        reportedById:   escReporter,
        assignedToId:   escAssignee,
        locationId:     locationIds[escalatedSeed.loc] ?? locationIds[0],
        assetId:        escalatedSeed.asset !== undefined ? (assetIds[escalatedSeed.asset] ?? null) : null,
        isEscalated:    true,
        escalationLevel:2,
        lastEscalatedAt:ago(escalatedSeed.days - 1),
        createdAt:      escCreatedAt,
        ...escSopFields,
      },
    })

    await prisma.issueEscalation.createMany({
      data: [
        { issueId: escIssue.id, fromLevel: 0, toLevel: 1, reason: "Initial escalation — equipment failure impacting production.", createdAt: ago(escalatedSeed.days - 0.5) },
        { issueId: escIssue.id, fromLevel: 1, toLevel: 2, reason: "Unresolved after 24 hours. Plant Manager notified.", createdAt: ago(escalatedSeed.days - 1) },
      ],
    })
  }

  // ── Injury report ─────────────────────────────────────────────────────────
  await prisma.injuryReport.create({
    data: {
      organizationId: orgId,
      reportedById:   techIds[0] ?? adminUserId,
      locationId:     locationIds[0],
      incidentDate:   ago(12),
      injuryType:     "laceration",
      bodyPart:       "hand",
      description:    "Worker sustained a laceration on the right palm while handling a sheet metal component without gloves. Cut approximately 1.5 inches long, moderate depth.",
      treatment:      "Wound cleaned and dressed on-site. Employee sent to urgent care for assessment. 2 stitches required. Returned to light duty next day.",
      aiGuidance:     "Apply direct pressure to control bleeding. Clean wound with sterile saline if available. Do not remove embedded material. Elevate hand above heart level. Seek medical evaluation for any laceration requiring closure.",
      status:         "REVIEWED",
      reviewedById:   managerIds[0] ?? adminUserId,
      reviewedAt:     ago(11),
      createdAt:      ago(12),
    },
  })

  // ── Purchase request ───────────────────────────────────────────────────────
  await prisma.purchaseRequest.create({
    data: {
      organizationId: orgId,
      submittedById:  techIds[1] ?? adminUserId,
      assetId:        assetIds[0] ?? null,
      itemName:       "Replacement Drive Motor Assembly",
      itemDescription:"OEM drive motor assembly for primary equipment. Current motor showing overheating and needs replacement before full failure. Part #: DRV-7840-XL. Vendor: ProMech Industrial.",
      estimatedCost:  1250.00,
      aiVerified:     true,
      aiConfidence:   0.91,
      aiAnalysis:     "Photo shows visible wear and heat discoloration consistent with described overheating. Part number matches equipment specification. Cost is within expected range for OEM replacement. Recommend approval.",
      status:         "APPROVED",
      approvedById:   managerIds[0] ?? adminUserId,
      approvedAt:     ago(5),
      notes:          "Approved. Order with ProMech on PO #4421. Expected delivery in 3–5 days.",
      createdAt:      ago(7),
    },
  })

  // ── A few issue comments for realism ─────────────────────────────────────
  // Find the escalated issue to add a comment thread
  const escalatedIssueRecord = await prisma.issue.findFirst({
    where: { organizationId: orgId, isEscalated: true },
    select: { id: true },
  })

  if (escalatedIssueRecord) {
    await prisma.issueComment.createMany({
      data: [
        {
          issueId:    escalatedIssueRecord.id,
          authorId:   techIds[0] ?? adminUserId,
          content:    "Hydraulic lines inspected — main pressure line has a crack at the elbow fitting near the base. Hydraulic fluid confirmed low.",
          isInternal: false,
          createdAt:  ago(2),
        },
        {
          issueId:    escalatedIssueRecord.id,
          authorId:   managerIds[0] ?? adminUserId,
          content:    "Vendor (ProMech Industrial) contacted. They can dispatch a technician tomorrow morning. Parts need to be ordered.",
          isInternal: true,
          createdAt:  ago(1),
        },
      ],
    })
  }

  // ── Demo QR codes (visible for Professional+ sessions) ───────────────────
  const firstLocId = locationIds[0]
  if (firstLocId) {
    await prisma.qrCode.createMany({
      data: [
        {
          organizationId: orgId,
          createdById:    adminUserId,
          name:           "Men's Restroom — Building A",
          description:    "Report cleaning issues, broken fixtures, or supply shortages.",
          area:           "Men's Restroom",
          locationId:     firstLocId,
          reportingMode:  "PUBLIC_ISSUE",
          defaultCategory:"FACILITY",
          allowedCategories: [],
          isActive:       true,
        },
        {
          organizationId: orgId,
          createdById:    adminUserId,
          name:           "Dock Door 12",
          description:    "Report safety hazards, equipment issues, or access problems at this dock.",
          area:           "Dock Door 12",
          locationId:     firstLocId,
          reportingMode:  "SAFETY_REPORTING",
          defaultCategory:"SAFETY",
          allowedCategories: [],
          isActive:       true,
        },
        {
          organizationId: orgId,
          createdById:    adminUserId,
          name:           "Compressor Room",
          description:    "Report equipment faults, unusual sounds, or safety concerns.",
          area:           "Compressor Room",
          locationId:     firstLocId,
          reportingMode:  "EMPLOYEE_REPORTING",
          defaultCategory:"EQUIPMENT_BREAKDOWN",
          allowedCategories: [],
          isActive:       true,
        },
      ],
    })
  }

  // ── Workforce Communications demo data ───────────────────────────────────
  await seedWorkforceCommsDemoContent({
    orgId,
    adminUserId,
    industryKey,
    userRecords: userRecords.map(u => ({ id: u.id, name: u.name, role: u.role })),
    assetIds,
    deptIds,
    locationIds,
    allUserIds,
  })
}

// ─── Professional Plus seed additions ─────────────────────────────────────────

async function seedPlusDemoContent(orgId: string, adminUserId: string) {
  // ── Fetch locations created by seedDemoContent ────────────────────────────
  const locations = await prisma.location.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  })
  const [locA, locB, locC] = locations

  // ── Regions ───────────────────────────────────────────────────────────────
  const [northRegion, southRegion] = await Promise.all([
    prisma.region.create({
      data: {
        name:           "North Region",
        description:    "Northern facilities — primary production and warehouse operations.",
        organizationId: orgId,
      },
    }),
    prisma.region.create({
      data: {
        name:           "South Region",
        description:    "Southern facilities — distribution and administrative hub.",
        organizationId: orgId,
      },
    }),
  ])

  // Assign locations to regions
  const updates: Promise<unknown>[] = []
  if (locA) updates.push(prisma.location.update({ where: { id: locA.id }, data: { regionId: northRegion.id } }))
  if (locB) updates.push(prisma.location.update({ where: { id: locB.id }, data: { regionId: northRegion.id } }))
  if (locC) updates.push(prisma.location.update({ where: { id: locC.id }, data: { regionId: southRegion.id } }))
  await Promise.all(updates)

  // ── Advanced escalation chain example ────────────────────────────────────
  const chain = await prisma.escalationChain.create({
    data: {
      name:             "Critical Equipment — 3-Step Escalation",
      description:      "Automatically escalates critical equipment failures through supervisors, plant manager, and executive leadership.",
      organizationId:   orgId,
      isActive:         true,
      triggerPriority:  "CRITICAL",
      triggerCategory:  "EQUIPMENT_BREAKDOWN",
      hoursToFirst:     1,
    },
  })
  await prisma.escalationChainStep.createMany({
    data: [
      { chainId: chain.id, stepOrder: 1, label: "Notify Supervisor",     role: "SUPERVISOR", hoursAfterPrevious: 1 },
      { chainId: chain.id, stepOrder: 2, label: "Escalate to Manager",   role: "MANAGER",    hoursAfterPrevious: 4 },
      { chainId: chain.id, stepOrder: 3, label: "Executive Notification", role: "ADMIN",     hoursAfterPrevious: 8 },
    ],
  })

  // ── Shared facility — pending partner invite (demonstrates UI) ───────────
  const { randomBytes } = await import("crypto")
  const inviteToken = randomBytes(32).toString("hex")
  await prisma.organizationRelationship.create({
    data: {
      orgIdA:           orgId,
      orgIdB:           null,
      orgBName:         "Riverside Logistics Co.",
      relationshipType: "facility_operator",
      status:           "pending",
      createdById:      adminUserId,
      inviteToken,
      inviteEmail:      "facilities@riverside-logistics.demo",
    },
  })

  // ── API key example (pre-created for demo realism) ─────────────────────
  const { createHash } = await import("crypto")
  const rawKey    = `rlk_${randomBytes(32).toString("hex")}`
  const keyHash   = createHash("sha256").update(rawKey).digest("hex")
  const keyPrefix = rawKey.slice(0, 12)
  await prisma.apiKey.create({
    data: {
      organizationId: orgId,
      name:           "Production Integration Key",
      keyHash,
      keyPrefix,
      isActive:       true,
      createdById:    adminUserId,
    },
  })

  // ── Webhook endpoint example ───────────────────────────────────────────
  const whSecret = `whsec_${randomBytes(32).toString("hex")}`
  const whHash   = createHash("sha256").update(whSecret).digest("hex")
  await prisma.webhookEndpoint.create({
    data: {
      organizationId: orgId,
      name:           "Zapier Integration",
      url:            "https://hooks.zapier.com/hooks/catch/example/demo/",
      secret:         whHash,
      events:         ["issue.created", "issue.escalated", "issue.resolved"],
      isActive:       true,
    },
  })
}

// ─── Workforce Communications demo content ────────────────────────────────────

async function seedWorkforceCommsDemoContent({
  orgId,
  adminUserId,
  industryKey,
  userRecords,
  assetIds,
  deptIds,
  locationIds,
  allUserIds,
}: {
  orgId:        string
  adminUserId:  string
  industryKey:  string
  userRecords:  Array<{ id: string; name: string; role: string }>
  assetIds:     string[]
  deptIds:      string[]
  locationIds:  string[]
  allUserIds:   string[]
}) {
  const now      = Date.now()
  const ago      = (days: number)  => new Date(now - days * 86400000)
  const fromNow  = (hours: number) => new Date(now + hours * 3600000)
  const hoursAgo = (hours: number) => new Date(now - hours * 3600000)

  // ── Users by role ────────────────────────────────────────────────────────
  const managers    = userRecords.filter(u => u.role === "MANAGER")
  const supervisors = userRecords.filter(u => u.role === "SUPERVISOR")
  const hrUsers     = userRecords.filter(u => u.role === "HR")
  const employees   = userRecords.filter(u => u.role === "EMPLOYEE")
  const fallback    = userRecords[0] ?? { id: adminUserId }

  const mgr = (i = 0) => (managers[i]    ?? fallback).id
  const sup = (i = 0) => (supervisors[i] ?? fallback).id
  const hr  = (i = 0) => (hrUsers[i]     ?? managers[0] ?? fallback).id
  const emp = (i = 0) => (employees[i]   ?? fallback).id
  const asset   = (i: number) => assetIds[i]    ?? null
  const dept    = (i: number) => deptIds[i]     ?? null

  // ── Find issues for linking ──────────────────────────────────────────────
  const escalatedIssue = await prisma.issue.findFirst({
    where:  { organizationId: orgId, isEscalated: true },
    select: { id: true },
  })
  const escId = escalatedIssue?.id ?? null

  const findIssue = async (keyword: string) => {
    const i = await prisma.issue.findFirst({
      where:  { organizationId: orgId, title: { contains: keyword, mode: "insensitive" } },
      select: { id: true },
    })
    return i?.id ?? null
  }

  // ── Seed data shapes ─────────────────────────────────────────────────────
  interface AsgInput {
    title:          string
    notes?:         string
    priority:       "low" | "medium" | "high" | "critical"
    status:         "pending" | "in_progress" | "completed"
    assigneeId:     string
    dueDate:        Date
    linkedIssueId?: string | null
    linkedAssetId?: string | null
  }
  interface AnnInput {
    title:                  string
    body:                   string
    priority:               "normal" | "urgent" | "emergency"
    scopeType:              "org" | "location" | "department"
    scopeId?:               string | null
    requiresAcknowledgment: boolean
  }
  interface EmgInput {
    type:             string
    title:            string
    body:             string
    resolvedHoursAgo: number
  }

  let asgSeeds: AsgInput[]    = []
  let annSeeds: AnnInput[]    = []
  let emgSeed:  EmgInput | null = null

  // ── Industry-specific data ───────────────────────────────────────────────
  switch (industryKey) {

    case "manufacturing": {
      asgSeeds = [
        { title: "Shut down Conveyor Line 2 for hydraulic inspection",     notes: "Tag out the line per LOTO procedure before beginning any inspection.",        priority: "high",    status: "in_progress", assigneeId: emp(0),  dueDate: fromNow(8),   linkedIssueId: escId           },
        { title: "Order replacement hydraulic hose from vendor",           notes: "Call ProMech first — they carry emergency stock for 4-hour delivery.",          priority: "medium",  status: "pending",     assigneeId: mgr(1),  dueDate: fromNow(32),  linkedIssueId: escId           },
        { title: "Inspect surrounding area for fluid contamination",       notes: "Check floor, drains, and all nearby equipment surfaces for hydraulic fluid.",   priority: "high",    status: "completed",   assigneeId: hr(0),   dueDate: fromNow(8),   linkedIssueId: escId           },
        { title: "Replace HVAC filter in Building B",                      notes: "Filter part number is listed on the HVAC panel door label.",                    priority: "low",     status: "pending",     assigneeId: sup(0),  dueDate: fromNow(72)                                  },
        { title: "Monthly forklift safety inspection — Forklift 3",       notes: "Use the standard forklift inspection checklist. Document all findings.",        priority: "medium",  status: "pending",     assigneeId: emp(0),  dueDate: fromNow(120), linkedAssetId: asset(4)        },
      ]
      annSeeds = [
        { title: "Conveyor Line 2 — Maintenance Shutdown",             body: "Conveyor Line 2 is currently shut down for hydraulic maintenance. Do not operate until further notice. All production should route through Lines 1, 3, and 4. Contact the Maintenance Supervisor with any questions.",                                                                                                                      priority: "urgent", scopeType: "department", scopeId: dept(0), requiresAcknowledgment: true  },
        { title: "Steel-Toed Boot Requirement — Production Area",     body: "Safety reminder: All personnel must wear steel-toed boots in the production area at all times. This applies to all shifts and to visitors. Non-compliance will result in immediate removal from the production floor.",                                                                                                                          priority: "normal", scopeType: "org",        requiresAcknowledgment: false },
        { title: "Shift B Meeting — Hydraulic Equipment SOP Review",  body: "Shift B meeting today at 2pm in the break room to review the new SOP for hydraulic equipment handling and maintenance procedures. Attendance is mandatory for all Maintenance team members.",                                                                                                                                                    priority: "normal", scopeType: "department", scopeId: dept(1), requiresAcknowledgment: false },
      ]
      emgSeed = {
        type:             "other",
        title:            "Hydraulic Fluid Spill — Conveyor Line 2",
        body:             "Hydraulic fluid spill detected near Conveyor Line 2. Area has been cordoned off. Do not enter until cleared by Safety. Spill response team is on-site. Estimated clearance: 45 minutes. All personnel have been accounted for.",
        resolvedHoursAgo: 2,
      }
      break
    }

    case "warehousing": {
      const dockIssueId = await findIssue("Dock door 7")
      asgSeeds = [
        { title: "Inspect Dock Door 7 — not closing properly",             notes: "Check seal, track alignment, and hydraulic cylinder. Document all findings before ordering parts.",      priority: "high",    status: "in_progress", assigneeId: emp(0),  dueDate: fromNow(8),   linkedIssueId: dockIssueId ?? escId },
        { title: "Count inventory in Aisle C before end of shift",        notes: "Use RF scanner and reconcile any variances with the WMS before logging off.",                             priority: "medium",  status: "pending",     assigneeId: sup(3),  dueDate: fromNow(8)                                              },
        { title: "Replace battery on Forklift 4",                         notes: "Coordinate with the charging station supervisor to ensure a charged spare battery is ready.",              priority: "medium",  status: "pending",     assigneeId: emp(0),  dueDate: fromNow(32),  linkedAssetId: asset(1)             },
        { title: "Clear Receiving Bay 3 before 6am shipment arrival",     notes: "Stage all current pallets in Zone D overflow area. Bay must be fully clear by midnight.",                  priority: "high",    status: "pending",     assigneeId: sup(0),  dueDate: fromNow(32)                                             },
      ]
      annSeeds = [
        { title: "Large Shipment Arriving at 6am Tomorrow",    body: "A large inbound shipment is arriving at Receiving Bay 3 at 6am tomorrow. Bay 3 must be completely cleared by end of shift tonight. Contact the Receiving Supervisor if you need staging space reassigned. Do not leave any pallets in Bay 3 overnight.",                                                                                               priority: "urgent", scopeType: "department", scopeId: dept(1), requiresAcknowledgment: true  },
        { title: "Dock Door 7 — Out of Service",               body: "Dock Door 7 is currently out of service due to a closing mechanism failure. Use Dock Door 8 as the alternate for all inbound and outbound traffic until repair is complete. Repair crew is scheduled for tomorrow morning.",                                                                                                                           priority: "urgent", scopeType: "org",        requiresAcknowledgment: false },
        { title: "Weekly Safety Walk — Friday at 8am",         body: "The weekly safety walk is scheduled for Friday at 8am. All supervisors are required to attend. Meet at the main dock entrance. Please complete your area pre-walk inspection checklist before the group walk begins.",                                                                                                                                  priority: "normal", scopeType: "org",        requiresAcknowledgment: false },
      ]
      emgSeed = {
        type:             "fire",
        title:            "Forklift Battery Fire — Charging Area Evacuated",
        body:             "A forklift battery fire occurred in the charging area. The area was evacuated and the fire was extinguished by on-site responders using a Class D extinguisher. Charging area is closed pending a fire marshal inspection. All personnel accounted for. No injuries reported.",
        resolvedHoursAgo: 4,
      }
      break
    }

    case "restaurants": {
      asgSeeds = [
        { title: "Call refrigeration repair service for Walk-in Cooler 1",   notes: "Use Arctic Cold Solutions — emergency line is on the vendor board in the manager office.",    priority: "critical", status: "in_progress", assigneeId: mgr(0),  dueDate: fromNow(4),  linkedIssueId: escId },
        { title: "Move perishables from Walk-in 1 to Walk-in 2",             notes: "Prioritize proteins and dairy first. Log all moved items on the transfer sheet on the cooler door.", priority: "critical", status: "completed",   assigneeId: sup(0),  dueDate: fromNow(4),  linkedIssueId: escId },
        { title: "Deep clean prep area after lunch service",                  notes: "Use NSF-approved cleaner on all food-contact surfaces. Must be complete before 3pm prep starts.",  priority: "medium",  status: "pending",     assigneeId: emp(0),  dueDate: fromNow(8)                       },
        { title: "Check and restock all hand sanitizer stations",             notes: "Check all 8 stations throughout the building. Log refill date on each station log card.",            priority: "low",     status: "pending",     assigneeId: sup(1),  dueDate: fromNow(8)                       },
      ]
      annSeeds = [
        { title: "Walk-in Refrigerator 1 — Out of Service",         body: "Walk-in Refrigerator 1 is temporarily out of service due to a cooling failure. All perishables have been moved to Walk-in 2. Do not open Walk-in 1. Refrigeration repair is on the way. Contact the Kitchen Manager with any questions about food storage.",                                                                                     priority: "urgent", scopeType: "department", scopeId: dept(0), requiresAcknowledgment: true  },
        { title: "Health Inspection — Next Tuesday",                 body: "A health inspection is scheduled for next Tuesday. All staff must review the food safety SOPs posted in the kitchen by end of this week. Priority areas: temperature logging, proper handwashing technique, and cross-contamination prevention. Questions? See your manager.",                                                                     priority: "normal", scopeType: "org",        requiresAcknowledgment: false },
        { title: "Saturday Evening — All Hands Required",            body: "Saturday evening is fully booked with two large parties and a full dining room. No time off has been approved for Saturday dinner service. All scheduled staff are expected on time and in full uniform. See your schedule for your assigned station.",                                                                                             priority: "normal", scopeType: "org",        requiresAcknowledgment: false },
      ]
      emgSeed = {
        type:             "other",
        title:            "Gas Smell Reported — Building Evacuated",
        body:             "A gas smell was reported in the kitchen area. The building was evacuated as a precaution. The gas company responded and confirmed a false alarm — a burner pilot had extinguished and gas briefly accumulated. The fire marshal gave the all-clear. The building is safe to re-enter. All staff accounted for.",
        resolvedHoursAgo: 24,
      }
      break
    }

    case "retail": {
      asgSeeds = [
        { title: "Call POS vendor support — Register 3 offline",                   notes: "Vendor support line: 1-800-555-0142. Reference contract #RT-4421. Ask for priority queue.",    priority: "high",   status: "in_progress", assigneeId: mgr(0),  dueDate: fromNow(4),  linkedIssueId: escId },
        { title: "Direct Register 3 customers to Registers 1 and 2",              notes: "Post the 'Temporarily Closed' sign on Register 3. Assist customers proactively at the transition.", priority: "high",   status: "completed",   assigneeId: sup(0),  dueDate: fromNow(4),  linkedIssueId: escId },
        { title: "Restock end caps in Electronics section before store opens",     notes: "Planogram for the current end cap is in the Electronics binder in the back office.",               priority: "medium", status: "pending",     assigneeId: sup(1),  dueDate: fromNow(8)                       },
        { title: "Weekly cart retrieval and parking lot inspection",               notes: "Note any cart damage, lot hazards, or lighting issues during the inspection. Log in Relay.",        priority: "low",    status: "pending",     assigneeId: emp(2),  dueDate: fromNow(8)                       },
      ]
      annSeeds = [
        { title: "Register 3 — Temporarily Offline",          body: "Register 3 is currently offline due to a system error. Please direct all customers to Registers 1 and 2. The IT team is working with the POS vendor on resolution. We will notify you when Register 3 is back online.",                                                                                                                                priority: "urgent", scopeType: "department", scopeId: dept(0), requiresAcknowledgment: true  },
        { title: "Corporate Store Audit — This Thursday",     body: "Corporate is conducting a store audit this Thursday. All departments must ensure displays and signage are current with the planogram, pricing is accurate, and back-of-house areas are organized and clean. Managers will be emailed the full audit checklist today.",                                                                                     priority: "normal", scopeType: "org",        requiresAcknowledgment: false },
        { title: "New Markdown Procedures — Effective Monday",body: "New markdown procedures take effect on Monday. All staff must review the updated SOP for markdown tagging and POS entry before your next shift. The SOP is available in the back office binder and on the team portal.",                                                                                                                                 priority: "normal", scopeType: "org",        requiresAcknowledgment: false },
      ]
      break
    }

    case "property": {
      asgSeeds = [
        { title: "Inspect roof at Unit 4B and document leak damage",              notes: "Take photos before touching anything. Note the extent of water damage to ceiling and walls.",      priority: "high",   status: "in_progress", assigneeId: sup(0),  dueDate: fromNow(8),  linkedIssueId: escId },
        { title: "Contact roofing contractor for emergency repair estimate",      notes: "We need same-week availability. Get at least two estimates before approving.",                       priority: "high",   status: "pending",     assigneeId: mgr(0),  dueDate: fromNow(8),  linkedIssueId: escId },
        { title: "Deliver water damage notice to Unit 4B and update tenant",     notes: "Use the standard water damage disclosure form. Offer temporary accommodations if unit is unlivable.", priority: "high",   status: "pending",     assigneeId: mgr(1),  dueDate: fromNow(8),  linkedIssueId: escId },
        { title: "Monthly common area inspection — Building A",                  notes: "Use the standard common area checklist. Note anything requiring repair or cleaning.",                  priority: "low",    status: "pending",     assigneeId: emp(0),  dueDate: fromNow(120)                       },
      ]
      annSeeds = [
        { title: "Roof Repair Work — Building C This Week",           body: "Roof repair work is scheduled for Building C this week. Residents may experience construction noise between 8am and 4pm. We apologize for the inconvenience and appreciate your patience during this necessary maintenance.",                                                                                                                    priority: "normal", scopeType: "org",        requiresAcknowledgment: false },
        { title: "Planned Water Shut-Off — Building B — Wednesday",   body: "There will be a planned water shut-off for Building B on Wednesday from 10am to 2pm for scheduled plumbing maintenance. All residents have been notified by mail. Hot water will also be unavailable during this window. Please plan accordingly.",                                                                                            priority: "urgent", scopeType: "org",        requiresAcknowledgment: true  },
        { title: "Work Order Logging Reminder",                        body: "Reminder to all Maintenance team members: all work orders must be logged in Relay before contacting any vendor or beginning any repair work. This ensures accurate cost tracking and compliance with our service level agreements.",                                                                                                            priority: "normal", scopeType: "department", scopeId: dept(0), requiresAcknowledgment: false },
      ]
      break
    }

    case "healthcare": {
      asgSeeds = [
        { title: "Inspect and repair HVAC unit — Patient Wing C",              notes: "Wear appropriate PPE. Coordinate with the Charge Nurse to minimize patient disruption.",              priority: "critical", status: "in_progress", assigneeId: emp(0),  dueDate: fromNow(8),  linkedIssueId: escId },
        { title: "Set up temporary cooling units in Patient Wing C hallway",   notes: "Retrieve portable coolers from the Facilities storage room on Level B. Place every 20 feet.",         priority: "critical", status: "completed",   assigneeId: sup(0),  dueDate: fromNow(8),  linkedIssueId: escId },
        { title: "Monthly fire extinguisher inspection — all floors",          notes: "Use the inspection log forms in the safety binder. Physically tag each extinguisher after checking.",   priority: "medium",   status: "pending",     assigneeId: hr(0),   dueDate: fromNow(120)                       },
        { title: "Terminal clean and sanitize Operating Room 2 after procedure", notes: "Follow the OR terminal cleaning protocol exactly. Supervisor must sign off before room is cleared.", priority: "high",     status: "pending",     assigneeId: sup(1),  dueDate: fromNow(8)                         },
      ]
      annSeeds = [
        { title: "HVAC Repair Underway — Patient Wing C",                       body: "The HVAC unit in Patient Wing C is currently under repair. Temporary cooling units have been deployed in the hallways. Facilities is monitoring temperatures continuously. Patient care operations can continue. Contact Facilities immediately if temperatures rise above 75°F.",                                                  priority: "urgent", scopeType: "department", scopeId: dept(0), requiresAcknowledgment: true  },
        { title: "Joint Commission Inspection — Preparation Required",          body: "The Joint Commission inspection window begins next month. All departments must complete their compliance checklists by end of this week. Department managers will receive their specific checklists via email today. This is a mandatory compliance requirement — no extensions will be granted.",                                    priority: "normal", scopeType: "org",        requiresAcknowledgment: false },
        { title: "Updated Hand Hygiene Protocol — Effective Immediately",       body: "A new hand hygiene protocol is effective immediately per infection control guidelines. Key change: gel must be applied for a minimum of 20 seconds, not 15. Updated posters are being placed at all nursing stations. Please review the full updated SOP. Questions? Contact Infection Control.",                                   priority: "urgent", scopeType: "org",        requiresAcknowledgment: false },
      ]
      emgSeed = {
        type:             "power_outage",
        title:            "Code Gray — Power Fluctuation in Building B",
        body:             "Code Gray declared in Building B following a power fluctuation. Backup generators activated successfully. All critical systems including life support, OR lighting, and nurse call systems are confirmed operational. Facilities Engineering is investigating the source. Main power was restored within 8 minutes. All clear issued. No patient impact.",
        resolvedHoursAgo: 6,
      }
      break
    }

    case "education": {
      asgSeeds = [
        { title: "Repair projector in Room 214 — bulb replacement",             notes: "Spare bulbs are in the AV cabinet in the main office. Check the model label for the correct bulb.", priority: "medium", status: "in_progress", assigneeId: emp(0),  dueDate: fromNow(8),   linkedIssueId: escId },
        { title: "Inspect all emergency exit lighting — Building A",            notes: "Test each unit with the test button. Replace any unit not holding charge for 90 minutes.",             priority: "medium", status: "pending",     assigneeId: hr(0),   dueDate: fromNow(120)                        },
        { title: "Set up chairs and AV for Thursday assembly in gymnasium",     notes: "Refer to the gymnasium setup diagram on file in the facilities office. AV is in the storage room.",    priority: "medium", status: "pending",     assigneeId: sup(0),  dueDate: fromNow(48)                         },
        { title: "Monthly grounds inspection — parking lots and walkways",      notes: "Note cracks, drainage issues, and lighting problems. Include photos in your inspection report.",        priority: "low",    status: "pending",     assigneeId: emp(0),  dueDate: fromNow(120)                        },
      ]
      annSeeds = [
        { title: "Projector Repair — Room 214",                  body: "The projector in Room 214 is being repaired today. Teachers with classes in Room 214 should contact the main office for alternate room assignments. We expect the repair to be completed by end of day.",                                                                                                                                              priority: "normal", scopeType: "department", scopeId: dept(2), requiresAcknowledgment: false },
        { title: "Campus Fire Drill — Friday at 10am",           body: "A campus-wide fire drill is scheduled for this Friday at 10am. All staff must review their building evacuation procedures before Friday. Assembly areas will be confirmed via email this week. Teachers: please review the exit map posted in your classroom with students before the drill.",                                                           priority: "urgent", scopeType: "org",        requiresAcknowledgment: true  },
        { title: "Hallway Lighting Work — Building C This Week", body: "Maintenance will be replacing hallway lighting in Building C after school hours this week (Monday through Thursday evenings). Some hallway sections may be temporarily unlit between 4pm and 6pm. Please plan your after-school schedule accordingly.",                                                                                                 priority: "normal", scopeType: "org",        requiresAcknowledgment: false },
      ]
      break
    }

    case "hospitality": {
      const hvacIssueId = await findIssue("HVAC Room Block C")
      asgSeeds = [
        { title: "Repair heating unit in Room 214 — guest reported no heat",       notes: "Check thermostat wiring and the HVAC unit above the room. Guest is impacted — treat as priority.",         priority: "high",    status: "in_progress", assigneeId: emp(0),  dueDate: fromNow(4),  linkedIssueId: hvacIssueId ?? escId },
        { title: "Relocate guest in Room 214 to Room 312 — complimentary upgrade", notes: "Offer Room 312 as a complimentary upgrade. Comp one night and add a breakfast amenity in PMS.",            priority: "high",    status: "completed",   assigneeId: mgr(1),  dueDate: fromNow(4),  linkedIssueId: hvacIssueId ?? escId },
        { title: "Deep clean and inspect Room 214 after heating repair",           notes: "Run the full room inspection checklist. Room should not be assigned again until cleared by supervisor.",     priority: "medium",  status: "pending",     assigneeId: sup(1),  dueDate: fromNow(8),  linkedIssueId: hvacIssueId ?? escId },
        { title: "Restock all minibar units — Floors 3 and 4",                    notes: "Use the minibar restock cart. Log all items pulled from storeroom on the minibar tracking sheet.",           priority: "low",     status: "pending",     assigneeId: emp(3),  dueDate: fromNow(8)                                               },
      ]
      annSeeds = [
        { title: "Room 214 — Out of Service",              body: "Room 214 is temporarily out of service for heating repair. The guest has been relocated. Do not assign Room 214 to any new guests until Maintenance and Housekeeping have both cleared the room. Update the PMS status to Out of Order until further notice.",                                                                                              priority: "urgent", scopeType: "org",        requiresAcknowledgment: true  },
        { title: "VIP Arrival Tonight — Suite 501",        body: "A VIP guest is arriving tonight in Suite 501. White glove service is required throughout their stay. All departments: please review the VIP service protocol document. Suite must be inspected by the Housekeeping Manager before 3pm. Food & Beverage has been notified for welcome amenity setup.",                                                        priority: "urgent", scopeType: "org",        requiresAcknowledgment: false },
        { title: "Pool Closure — Thursday 8am to 12pm",   body: "The pool will be closed for chemical treatment on Thursday from 8am to 12pm. Please update guest-facing signage at the pool entrance and at the front desk before Thursday morning. The Guest Services team should proactively contact guests with pool reservations during this window.",                                                                     priority: "normal", scopeType: "org",        requiresAcknowledgment: false },
      ]
      break
    }

    case "multisite": {
      asgSeeds = [
        { title: "Diagnose and repair gate entry system — keypads not responding",  notes: "Check power to the keypad panels first, then the gate controller board. Call vendor if board needs replacement.", priority: "critical", status: "in_progress", assigneeId: emp(0),  dueDate: fromNow(8),   linkedIssueId: escId },
        { title: "Post manual access notice at gate and notify customers",           notes: "Post the standard Gate Under Repair sign. Override access code is 4471 — include in posted signage.",              priority: "high",    status: "completed",   assigneeId: mgr(1),  dueDate: fromNow(8),   linkedIssueId: escId },
        { title: "Inspect all unit locks in Row C after break-in attempt",          notes: "Check every lock for tampering or forced-entry damage. File a police report if locks are found compromised.",       priority: "high",    status: "in_progress", assigneeId: emp(2),  dueDate: fromNow(8)                          },
        { title: "Restock and test all vacuum stations — Units 1 through 4",        notes: "Each vacuum unit should run uninterrupted for at least 2 minutes. Restock coin changers if needed.",                priority: "low",     status: "pending",     assigneeId: emp(4),  dueDate: fromNow(120)                        },
      ]
      annSeeds = [
        { title: "Gate Entry System — Temporary Outage",               body: "The gate entry system is temporarily down and not responding to keypads. Customers can access their units using the manual override code: 4471. Enter code then press #. The repair team is on-site and expects to have the system restored within 2–3 hours. We apologize for the inconvenience.",                                         priority: "urgent", scopeType: "org", requiresAcknowledgment: true  },
        { title: "Monthly Site Inspection — This Friday",              body: "The monthly site inspection is scheduled for this Friday. All managers should ensure their areas are clean, compliant, and free of safety hazards before the inspection begins. Any deferred maintenance items must be logged in Relay before end of day Thursday.",                                                                           priority: "normal", scopeType: "org", requiresAcknowledgment: false },
        { title: "New Security Camera System — Installation Monday",   body: "A new security camera system installation begins on Monday. Some camera feeds will be temporarily offline during the installation process. Full security coverage will be maintained throughout. Installation is expected to complete by Wednesday.",                                                                                            priority: "normal", scopeType: "org", requiresAcknowledgment: false },
      ]
      break
    }

    default:
      return
  }

  // ── Create assignments ──────────────────────────────────────────────────
  const createdAssignments = await Promise.all(
    asgSeeds.map(a =>
      prisma.assignment.create({
        data: {
          orgId,
          title:         a.title,
          notes:         a.notes ?? null,
          priority:      a.priority,
          status:        a.status,
          assigneeId:    a.assigneeId,
          assignedById:  adminUserId,
          dueDate:       a.dueDate,
          linkedIssueId: a.linkedIssueId ?? null,
          linkedAssetId: a.linkedAssetId ?? null,
          completedAt:   a.status === "completed" ? hoursAgo(2) : null,
          createdAt:     hoursAgo(6),
        },
      })
    )
  )

  // Status history for completed assignments
  const historyData: Array<{
    assignmentId: string
    fromStatus:   "pending" | "in_progress"
    toStatus:     "in_progress" | "completed"
    changedById:  string
    note:         string
    createdAt:    Date
  }> = []
  for (let i = 0; i < asgSeeds.length; i++) {
    if (asgSeeds[i].status === "completed") {
      historyData.push(
        { assignmentId: createdAssignments[i].id, fromStatus: "pending",     toStatus: "in_progress", changedById: asgSeeds[i].assigneeId, note: "Started work on this assignment.",       createdAt: hoursAgo(4) },
        { assignmentId: createdAssignments[i].id, fromStatus: "in_progress", toStatus: "completed",   changedById: asgSeeds[i].assigneeId, note: "Assignment completed successfully.",     createdAt: hoursAgo(2) },
      )
    }
  }
  if (historyData.length > 0) {
    await prisma.assignmentStatusHistory.createMany({ data: historyData })
  }

  // ── Create announcements ────────────────────────────────────────────────
  const createdAnnouncements = await Promise.all(
    annSeeds.map(a =>
      prisma.announcement.create({
        data: {
          orgId,
          title:                  a.title,
          body:                   a.body,
          priority:               a.priority,
          scopeType:              a.scopeType,
          scopeId:                a.scopeId ?? null,
          createdById:            adminUserId,
          requiresAcknowledgment: a.requiresAcknowledgment,
          createdAt:              hoursAgo(3),
        },
      })
    )
  )

  // Acknowledgments — half the users have ack'd the requiresAcknowledgment ones
  const ackData: Array<{ announcementId: string; userId: string; acknowledgedAt: Date }> = []
  for (let i = 0; i < annSeeds.length; i++) {
    if (annSeeds[i].requiresAcknowledgment) {
      const half = allUserIds.slice(0, Math.ceil(allUserIds.length / 2))
      for (const userId of half) {
        ackData.push({ announcementId: createdAnnouncements[i].id, userId, acknowledgedAt: hoursAgo(1) })
      }
    }
  }
  if (ackData.length > 0) {
    await prisma.announcementAcknowledgment.createMany({ data: ackData, skipDuplicates: true })
  }

  // ── Create emergency broadcast (resolved) ──────────────────────────────
  if (emgSeed) {
    const resolvedAt = hoursAgo(emgSeed.resolvedHoursAgo)
    const createdAt  = hoursAgo(emgSeed.resolvedHoursAgo + 1)

    const broadcast = await prisma.emergencyBroadcast.create({
      data: {
        orgId,
        type:        emgSeed.type as never,
        title:       emgSeed.title,
        body:        emgSeed.body,
        scopeType:   "org",
        createdById: adminUserId,
        resolvedAt,
        resolvedById: mgr(0),
        createdAt,
      },
    })

    // All users acknowledged the resolved broadcast
    await prisma.emergencyAcknowledgment.createMany({
      data: allUserIds.map(userId => ({
        emergencyBroadcastId: broadcast.id,
        userId,
        acknowledgedAt:       new Date(resolvedAt.getTime() - 5 * 60 * 1000),
      })),
      skipDuplicates: true,
    })
  }
}
