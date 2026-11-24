# CleanWare — Product, Functionality & Usability Audit

**Audit type:** Read-only product audit. No code, database, or deployment was changed.
**Date:** 2026-11-24
**Audience:** Product advisor / founder review. Written so a second reviewer without repository access can act on it.
**Method:** Direct inspection of source routes, UI components, RBAC, the capability registry, Prisma models, and the demo seed. Live-demo behavior is cited only where it was verified in prior deployment rounds; items I could not exercise at runtime in this session are flagged **[not runtime-verified]**.

---

## 1. Executive assessment

CleanWare is **far more complete than a typical pre-launch cleaning SaaS**. It is a genuine multi-tenant cleaning ERP: 95 database models, ~75 admin pages, ~10 cleaner field pages, ~200 API routes, a four-tier capability-gated packaging model (Solo/Essentials/Professional/Enterprise), a customer portal, public booking/apply/pay/proposal flows, a shared time-clock kiosk, and a seeded interactive demo. The breadth already exceeds Swept and approaches the operational surface of Jobber/Housecall Pro, with ERP costing features (labor budgets, indirect-cost allocation, site profitability) that those SMB tools do not have.

The gap is **not missing modules — it is "last-mile" product coherence**: places where a capable backend exists but the UI does not expose it, where records can be created and listed but not edited or navigated between, and where one or two role-defining artifacts (a real employee profile page, a platform Super Admin console) are absent. These are the exact friction points a hands-on owner hits, and they disproportionately shape the perception of whether the product is "finished."

**Bottom line:** The engine is commercial-grade. The remaining work is primarily **connective tissue and editing controls**, plus two net-new surfaces (employee profiles, Super Admin). None of the findings below require re-architecture.

**Condition by area (traffic light):**

| Area | State |
|---|---|
| Scheduling / jobs / dispatch | 🟢 Strong |
| Cleaner field app | 🟢 Strong (recently corrected) |
| Inspections / QC | 🟢 Strong |
| Issues / complaints / corrective work | 🟢 Strong |
| Billing / invoicing / AR / tax | 🟢 Strong |
| Customers / sites | 🟡 Strong records, weak cross-navigation |
| Estimates / quotes / contracts / leads | 🟡 Mixed detail-page coverage |
| Service areas & exclusions | 🟡 Backend complete, **no edit UI** |
| Employee management | 🔴 **No profile page** (peek only) |
| Platform / Super Admin | 🔴 **Does not exist** (email-allowlist feedback console only) |
| Supplies / inventory | 🟡 Functional but simplistic (see §4) |

---

## 2. Complete feature inventory & implementation status

Capability keys come from `src/lib/entitlements/capabilities.ts`; tier mapping from `src/lib/entitlements/packages.ts`. Customer-facing names: **Solo** ($49) ⊂ **Essentials** ($99) ⊂ **Professional** ($199) ⊂ **Enterprise** (contact sales). Enterprise capabilities (`enterprise.*`) are **roadmap only — unbuilt**, correctly sold as "contact sales."

### Solo tier (owner-operator)
| Module | Route | Backend | UI access | Notes |
|---|---|---|---|---|
| Customers | `/customers`, `/customers/[id]` | ✅ | ✅ Full detail + edit + archive | Rich; see §6 for navigation gaps |
| Locations/sites | `/locations`, `/customers/[id]/sites/[siteId]` | ✅ | ✅ Rows link to site detail | No standalone `/locations/[id]` |
| Checklists | `/sops`, templates | ✅ | ✅ | |
| Service plans | via customer/site | ✅ | ✅ | |
| Scheduling | `/schedule` | ✅ | ✅ day/week/month, filters, inspection+corrective overlays | Unified calendar (recent) |
| Jobs | `/jobs`, `/jobs/[id]` | ✅ | ✅ clickable (peek + detail) | |
| Task ownership | field + job | ✅ | ✅ | |
| Estimates | `/estimates`, `/estimates/[id]` | ✅ | ✅ incl. bid worksheet, proposal PDF | |
| Invoicing | `/billing/invoices/[id]` | ✅ | ✅ | |
| Online payments | public `/pay/[token]` | ✅ | ✅ Stripe | |
| Sales tax | `/billing/tax` | ✅ | ✅ | |
| Period (recurring) invoicing | cron | ✅ | ✅ | |

### Essentials tier (adds a team)
Employees, assignments, **field app**, time tracking + approval, coverage/availability/callouts, payroll **export**, hiring/applicants/onboarding, notifications (email/SMS), geofencing (present, off by default), **whole inspection program**, **whole issue lifecycle**, work verification, employee/workplace reports, data import (CSV w/ preview+rollback), customer portal, accounting exports (QBO/Xero/Gusto/ADP CSV), AR aging.

### Professional tier (advanced + ERP costing)
Bid calculator, contracts, multi-channel quoting, SOP library (versioning/ack/section-search), work orders + change orders, **service areas + exclusions**, access & key management (encrypted codes), commission/crew pay, shift differentials + labor burden, compliance (credentials + site requirements), profitability, performance analytics, labor budgets, indirect-cost pools/site profitability, asset register + maintenance, supply inventory.

**Implementation status:** Every non-Enterprise capability key maps to a shipped, reachable feature. The capability catalog is disciplined — there are no "label-only" keys. Gating is enforced server-side (`canUse`, `orgHasCapability`), not by branching on tier, so repackaging is a data change.

---

## 3. Module-by-module usability & functionality findings

**Scheduling (`/schedule`).** Strong. Day/week/month, site-local timezone bucketing, lane packing, filters for person/customer/location/type, and overlays for scheduled inspections and corrective work orders as typed color-coded events (`src/app/(admin)/schedule/page.tsx`). Supervisors can filter to themselves, approximating a personal calendar. **Gap:** inspection events deep-link to `/inspections` (the list), not a specific scheduled-inspection record — a minor dead-end. No crew/team grouping dimension beyond individual person filter.

**Jobs (`/jobs`).** Strong. Clickable names (peek slide-over + full `/jobs/[id]`), unassigned/understaffed badges, new-job creation. 

**Inspections (`/inspections`).** Strong and recently corrected: when prerequisites (an active template + a service location) are missing, the page explains what's needed and offers a "New template" CTA instead of a silently disabled button (`canCreate` logic, lines 58–68). Ad-hoc and scheduled (recurring/randomized w/ inspector pool) both supported.

**Issues / complaints / corrective work.** Strong lifecycle: OPEN→ACKNOWLEDGED→RESOLVED→CLOSED with separate-person verification enforced (`verifyIssue` blocks self-verify), SLA deadlines, routing rules, escalation, convert-to-work-order, complaint responsibility tracking. Issue detail links customer + service location (recent fix).

**Billing / AR / tax / collections.** Strong. Invoice detail, payments, AR aging, collections steps, tax jurisdictions, period invoicing, Stripe. Customer detail surfaces outstanding balance, invoice table, payment history, collections opt-out.

**Customers / sites.** Records are rich (edit, archive-with-exclusion-warning, contacts, sites, portal access, proposals, messages) but **cross-navigation is thin** — see §6.

**Service areas & exclusions (`/service-areas`).** **Most material module-level defect.** The backend fully supports editing an area's name/ZIPs/radius/office label (`updateServiceArea` maps every field; API PATCH accepts `serviceAreaUpdateSchema`). **The UI exposes only Activate/Deactivate and Delete — there is no edit form** (`src/components/service-areas/service-areas-client.tsx`). Exclusion **zones and contacts** can only be Added or Removed (no edit). Only excluded **addresses** have a real detail page (`/service-areas/exclusions/[id]`) with the occupant-change/lift/reinstate workflow. So an owner who fat-fingers a ZIP must delete and recreate the area. This matches the reported complaint exactly.

**SOPs, assets, supplies, compliance, skills, coverage, hiring/onboarding, kiosks, time, pay periods, differentials, exports, import, reports.** All present and reachable. Supplies/inventory is functional but conceptually thin (see §4). Reports (profitability, satisfaction, supply spend, indirect costs, labor budgets) exist as dedicated pages.

---

## 4. Cleaner field application — detailed assessment

The field app is a **genuine mobile-first field-service experience**, not disconnected ERP panels. Four stable bottom tabs — Today / Schedule / Reports / More — never change shape by plan (`field-tabbar.tsx`); everything plan-dependent lives on the `/me` "More" hub.

**A cleaner's day, as the software actually supports it:**

1. **Open app → `/today`** (`src/app/(field)/today/page.tsx`): greeted with today's jobs grouped In progress / Upcoming / Completed, each card showing time, customer, site, address, and checklist progress. Outstanding SOP acknowledgments and a "My work history" shortcut surface at top when those plans are on.
2. **Review schedule → `/my-schedule`**: 14-day agenda grouped by day (Today/Tomorrow/weekday), job cards with checklist counts.
3. **Travel / arrive → open a job (`/job/[id]`)**: header shows customer, site, address, scheduled time, and **access notes** (highlighted amber). This is the "how do I get in" information cleaners need.
4. **Clock in**: single large sticky button; best-effort geolocation captured silently, proceeds even if denied.
5. **Instructions & scope**: checklist ("Scope of work") with per-item instructions, required-item markers, and required-photo capture (camera, with retry-on-failure that keeps the file).
6. **Coordinate with crew**: other assigned cleaners are listed as report subjects; task ownership lets cleaners **Claim** unowned tasks, **Mark done**, and (peer verification) **Verify/Reject** a teammate's task — self-verification blocked.
7. **Complete work / verification**: task states To do → In progress → Done → Awaiting check → Verified / Fix needed → Re-check, all visible inline.
8. **Report a problem**: category + description + optional photo, creates an Issue; issue persists even if the photo upload fails (retry preserves the issue).
9. **Workplace concerns/reports**: separate "Report a concern" entry (employee reports) + "View reports I've submitted" → `/my-reports`.
10. **Supplies**: `SupplyUsagePanel` on the job — tap a supply, enter quantity, "Use." No stock levels or costs shown to the cleaner (correct).
11. **Clock out & finish**: unpaid-break minutes input; clock-out is **blocked** with a clear list when required tasks/photos are unmet (`unmet` 422 handling).
12. **Hours / upcoming**: `/my-time` (clock history with computed hours + approval status) and `/my-work` (own completion/verification/rework/substantiated-findings metrics, privacy-protected — unproven complaints never shown).

**Strengths:** realistic single-hand ergonomics, required-photo gating, offline-tolerant uploads with retry, clock-out guardrails, privacy-aware self-performance view, access notes on the job.

**Weaknesses / gaps:**
- **Supply model is simplistic for real operations.** It's a flat org-level supply list with a single stock number and one unit (`Supply`, `SupplyUsage`, `SupplyAdjustment`). There is **no per-location/per-vehicle/per-closet inventory distribution**, no concept of what's stocked *at this site*, and **no cleaner-initiated supply *request/replenishment*** — the cleaner can only *log consumption*. The `/me` hub even tells cleaners "open a job and use the Supplies panel," confirming there is no standalone request flow. Real crews run out of liners at a site and need to *ask for more*; that round-trip doesn't exist. **[Recommend: a lightweight "request supplies" action + optional per-site par levels.]**
- **No in-app navigation/directions** — address is shown as text, not a maps deep link.
- **No crew messaging/coordination channel** beyond seeing who else is assigned; "coordinate with other cleaners" is not really supported.
- **No explicit "additional/corrective work" entry from the field** — corrective work orders are assigned by management and appear on the schedule, but a cleaner can't initiate "customer asked for extra X."
- **"Reports" as a bottom tab** may over-index a secondary function for daily use; many cleaners will rarely file reports.

**Verdict:** Resembles a professional field app, not a thin ERP shell. The supply/replenishment workflow is the one piece that would feel unrealistic to an operations manager.

---

## 5. Management & supervisor workflow assessment

**Role model (`src/lib/rbac.ts`):** OWNER/ADMIN (all routes), MANAGER (broad: ops + accounts + finance + workforce, minus org settings), SUPERVISOR (narrow: dashboard, schedule **read-only**, jobs, time, inspections, issues, employee-reports, service-requests), CLEANER (field only), CLIENT (portal only). This is sensible and consistently enforced in middleware + per-page guards + nav filtering.

**Dashboard** is role-aware (renders "Supervisor Dashboard"; setup/shortcut cards gated by `canManageAccounts` + capability + route access).

**Information flow is coherent:** field completion → job status → inspections/issues → corrective work orders → customer complaints → performance history; time entries → approval → pay periods → payroll export; estimates → proposals → conversion → jobs → invoices → AR → collections. These chains are real and wired.

**Friction points:**
- **Supervisors have no team-scoped view.** Time approval and performance are org-wide Manager+ only because "we have no supervisor→team scoping yet" (comment in `rbac.ts`). A supervisor sees the whole schedule but can't be scoped to *their* crew. For mid-size companies this is a real limitation.
- **Dispatch is calendar-based, not a dispatch board.** There's no drag-to-assign or map-based dispatch; assignment happens per-job. Adequate for recurring commercial routes, weaker for reactive same-day dispatch.
- **Some management actions live only in row-action menus / dialogs** (leads, team) rather than detail pages, so "open the record, see everything, act" isn't uniform (see §6).

---

## 6. Missing record details, editing controls & related-record navigation

This is the **highest-leverage cluster of fixes**. Pattern: list pages exist and often have clickable primary records, but detail-page coverage and cross-links are inconsistent.

**List pages with NO detail page or expandable record** (owner must manage via row-action dialogs only):
`/leads`, `/service-requests`, `/service-areas` (areas), `/skills`, `/compliance`, `/pay-rules`, `/hiring`, `/access`, `/differentials`, `/kiosks`, `/coverage`, `/time`, `/import`, `/exports`. Some of these (coverage, time, exports, import) are legitimately workspace/tool pages. But **leads and service-requests are business records that deserve a detail view**, and `/team` deserves a profile (see §7).

**Clickability inconsistencies:**
- **Leads** (`/leads`): the company/name is plain text, not a link — no way to open a lead. Managed only through `LeadRowActions`.
- **Work-order search results** route to `/work-orders` (list), not `/work-orders/[id]` (`src/lib/data/search.ts`) — a dead-end despite the detail page existing.
- **Employee references everywhere** (`/team`, search, peeks) point to `/team`, never a profile — see §7.

**Editing-control gaps:**
- **Service areas: no edit UI** despite full backend support (detailed in §3). Exclusion zones/contacts: no edit.
- Generally, "Activate/Deactivate + Delete but not Edit" recurs; verify each list for an edit affordance.

**Related-record navigation gaps (within detail pages):**
- **Customer detail** (`/customers/[id]`) links to invoices, payments, sites, portal, proposals, service-areas — but **does not list or link the customer's jobs, contracts, estimates/quotes, or active service plans**. From a customer you cannot reach their work or their agreement. This is the most-felt navigation hole.
- Workplace-report → subject-employee is not linked (no employee profile to link to — §7).

**What already works well (for balance):** jobs, invoices, issues, inspections, work orders, quotes, estimates, assets, supplies, SOPs, performance, onboarding, and the excluded-address record all have real detail pages; global command-palette search spans customers/sites/jobs/employees/invoices/issues/work-orders; peek slide-overs give quick looks without full navigation.

---

## 7. Employee profiles & Super Admin findings

### Employee profiles — **missing**
There is **no employee profile page.** `/team` lists employees; clicking a name opens a **4-field peek** (status, phone, email, code) that links back to `/team` (`peekEmployee` in `src/lib/data/peek.ts`). There is an `/api/team/[id]` endpoint but **no `/team/[id]` page.**

Yet the data to build a real profile already exists and is scattered across modules: `EmployeeProfile` (pay type/rate, employment status, hire date, emergency contact, kiosk PIN), `JobAssignment`, `TimeEntry`, `EmployeeSkill`/`Skill`, `Credential`/compliance, `Inspection` (as inspector), `EmployeeReport`, performance (`getMyPerformance`), availability, onboarding, pay rules. **Recommendation:** a role-gated `/team/[id]` profile aggregating identity + employment + schedule + timekeeping + skills/credentials + performance + authorized workplace records, with every employee reference across the app (team list, search, job crew, assignments, reports) linking to it. This is a **net-new page over existing data** — no new models needed.

### Super Admin — **does not exist as a portal**
There is **no platform-level administration surface.** The only cross-org concept is `isPlatformAdmin()` (`src/lib/platform-admin.ts`), an **email-allowlist** (`CLEANWARE_PLATFORM_ADMIN_EMAILS` env) that gates exactly one page — the **software feedback console** (`/feedback`), which reads bug/feature submissions across orgs. That console correctly does **not** appear in customer-org navigation and is not granted by org ownership.

**Missing for a real Super Admin portal:** organization directory + impersonation/support access, subscription/trial/package management and overrides (per-org capability overrides exist in code but have no admin UI), user management across tenants, demo-account lifecycle/health, system health/metrics, and incorporation of the feedback console into that portal. Today, platform operations (changing a tenant's tier, helping a stuck customer, seeing signups) require database access — **not viable at scale.** This is the single biggest *operational* (vs. customer-facing) gap.

---

## 8. Prioritized deficiencies & recommendations

**P0 — Blocks a confident commercial launch**
1. **Super Admin portal** (§7): org directory, subscription/tier management (surface the existing per-org capability overrides), trials, support access, demo/system health. Fold the feedback console in. *Without this, you cannot operate the business without raw DB access.*
2. **Service-area edit UI** (§3/§6): expose the already-built update endpoint; add edit for exclusion zones/contacts. *Small effort, high visibility; already reported by the user.*

**P1 — Needed for a credible, coherent product**
3. **Employee profile page** `/team/[id]` (§7) and link every employee reference to it.
4. **Customer → related records**: add Jobs, Contracts, Estimates/Quotes, and Service plans sections/links to `/customers/[id]` (§6).
5. **Leads**: make rows open a detail (or expandable) record; fix work-order search → detail link (§6).
6. **Field supply request/replenishment** + optional per-site par levels (§4).
7. **Systematic edit-affordance pass**: audit every list for "can create/view but not edit"; the service-areas pattern likely recurs.

**P2 — Significant usability improvements (post-launch OK)**
8. Supervisor team-scoping (scope schedule/time/performance to a supervisor's crew) (§5).
9. Field app: maps deep-link for addresses; lightweight crew coordination; field-initiated extra-work request.
10. Scheduling: inspection events deep-link to the scheduled record; consider a crew dimension.

**P3 — Optional / later**
11. Dispatch board (drag-to-assign/map) for reactive same-day work.
12. Enterprise tier build-out (multi-branch/regions, SSO, API) — only when a real prospect asks (already the stated policy).

---

## 9. Remaining requirements for commercial launch readiness

Benchmarked against Jobber, Housecall Pro, Swept, Aspire, TEAM/WinTeam:

**Essential before launch (must-fix):**
- Super Admin portal to operate tenants/subscriptions/support (P0 #1).
- Edit controls wherever records can be created (service areas first) (P0 #2, P1 #7).
- Employee profile page (P1 #3) — competitors all have one; its absence reads as "unfinished."
- Customer 360 cross-navigation to jobs/contracts (P1 #4).

**Correction of existing functionality (should-fix):**
- Leads detail + work-order search link (P1 #5).
- Field supply replenishment (P1 #6).

**Usability improvements (can follow shortly after launch):**
- Supervisor scoping, field maps/coordination, dispatch ergonomics (P2).

**Already launch-ready and competitive:** scheduling, jobs, inspections/QC, issue & complaint lifecycle, work verification, billing/AR/tax/collections, the cleaner field core loop, time tracking → payroll export, customer portal, public intake (book/apply/pay/proposal), and the four-tier packaging model. The ERP costing layer is a genuine differentiator versus SMB competitors.

---

## 10. Verification methodology & limitations

**Verified by direct code/route/model inspection (this session):** route/page inventory; RBAC and route-access matrix; capability catalog and tier mapping; cleaner field pages and components; service-area edit gap (UI vs. `updateServiceArea`/API); absence of `/team/[id]` and the 4-field `peekEmployee`; absence of any Super Admin page beyond the email-allowlist feedback console; customer-detail related-record coverage; search entity coverage and the work-order dead-link; inspections prerequisite UX; demo seed content (6 commercial + 6 residential customers, staff across all roles, templates, inspection scheduling, accountability data, supplies with below-reorder items, leads, differentials, indirect costs, kiosk, onboarding).

**Relied on prior-round live verification (not re-exercised here):** end-to-end demo role switching and multi-perspective behavior on `app.cleanware.software` were confirmed in earlier deployment rounds; this audit did not re-run a live demo session.

**Could not verify at runtime in this session [not runtime-verified]:** actual on-device rendering/ergonomics of the field app; real browser screenshot/recording capture in the feedback dialog; Stripe/SMS/email side effects; geofencing enforcement; that every row-action dialog across all ~75 admin pages behaves correctly. A full launch-readiness sign-off should include a scripted multi-role click-through of the populated demo (Owner/Manager/Supervisor/Cleaner) exercising create→view→edit→navigate on every primary record, since compilation and HTTP 200s do not prove a workflow is usable.

**Scope caveat:** findings emphasize breadth over exhaustive per-page depth. The edit-affordance and clickability patterns identified (§6) are likely to recur on pages not individually opened here; treat the named examples as representative, not a closed list.
