import { STEPS, type Step } from "./steps"

// Guided workflow walkthroughs (Phase 46). The same spotlight engine that powers
// the demo overview tour also drives short, task-focused walkthroughs that teach
// a real workflow in the live app — no second simulated app, no duplicate data.
// Each flow spotlights the real pages/anchors a user would actually use.

export type Flow = {
  id: string
  label: string
  description: string
  steps: Step[]
}

const scheduling: Step[] = [
  { title: "Your week at a glance", body: "The schedule lays out the week by status. Recurring service plans roll out into real jobs automatically — anything unassigned stands out so you can staff it before it's a no-show.", path: "/schedule", selector: "main h1" },
  { title: "Open the job to schedule", body: "Jobs come from service plans or you add them directly. Open any job to set its date, time window and site.", path: "/jobs", selector: "a[href^='/jobs/']" },
  { title: "Set the recurring cadence once", body: "On a customer's site, the service plan (nightly, weekly, biweekly) defines the rhythm — the calendar fills itself from there, so you schedule once, not every week.", path: "/customers", selector: "a[href^='/customers/']" },
]

const assigning: Step[] = [
  { title: "Find the work that needs a crew", body: "The Jobs list shows every visit and whether it's staffed. Unassigned jobs are where you start.", path: "/jobs", selector: "main h1" },
  { title: "Open a job to assign cleaners", body: "Open any job and assign cleaners. The system knows who's available and who already works that site, so you put the right people on it.", path: "/jobs", selector: "a[href^='/jobs/']" },
  { title: "Cover a call-out fast", body: "When a cleaner is out, their jobs show here as uncovered. 'Find coverage' suggests who can step in — reassign in a couple of taps before the client notices.", path: "/coverage", selector: "main h1" },
]

const tasks: Step[] = [
  { title: "Tasks have owners", body: "Each checklist item on a job can be owned by a specific cleaner and needs a proof photo where required — so accountability is per task, not per visit.", path: "/jobs", selector: "a[href^='/jobs/']" },
  { title: "Work happens in the field app", body: "On their phone, a cleaner clocks in, works the checklist, snaps required photos, and marks each task done — all from the site.", path: "/jobs", selector: null, field: true },
  { title: "Verify completed work", body: "Back in the office, a supervisor reviews completed tasks and marks them verified or rejected. Rejections go back for rework, so quality is confirmed, not assumed.", path: "/jobs", selector: "main h1" },
]

const inspections: Step[] = [
  { title: "Start from a template", body: "An inspection template is your reusable scoring checklist. Build it once with critical items weighted, then score sites against it.", path: "/inspections", selector: "main h1" },
  { title: "Run or schedule an inspection", body: "Inspect a completed job, or set a recurring/randomized schedule so sites get checked on a cadence — optionally assigning a random eligible inspector each time.", path: "/inspections", selector: "a[href^='/inspections/']" },
  { title: "A fail becomes a fix", body: "Finalizing a failing inspection opens a quality issue and can auto-create a non-billable corrective work order — the fix is tracked to done, then re-inspected.", path: "/issues", selector: "main h1" },
]

const complaints: Step[] = [
  { title: "Every complaint in one place", body: "Customer complaints land here as issues you can track from raised to resolved — never buried in someone's texts.", path: "/issues/complaints", selector: "main h1" },
  { title: "Investigate and attribute fairly", body: "Open a complaint to record a finding (substantiated or not) and link it to the task and the people responsible — only substantiated complaints count against anyone.", path: "/issues/complaints", selector: "a[href^='/issues/']" },
  { title: "Resolve with corrective work", body: "Spin up a corrective work order to make it right, assign it, and close the loop — the customer sees follow-through, you keep the record.", path: "/work-orders", selector: "main h1" },
]

const invoicing: Step[] = [
  { title: "Completed work becomes an invoice", body: "Finished jobs turn into invoices automatically — open Invoices to review, then send a clean PDF to the customer. No double entry.", path: "/billing/invoices", selector: "main h1" },
  { title: "Open an invoice to send it", body: "Open any invoice to review the lines, apply tax, and send or share a pay link. Online payment is handled for you.", path: "/billing/invoices", selector: "a[href^='/billing/invoices/']" },
  { title: "Record the money in", body: "Log payments against invoices here — the invoice updates itself to paid or partially paid, so receivables always match reality.", path: "/billing/payments", selector: "main h1" },
  { title: "Chase what's overdue", body: "AR aging shows every unpaid invoice by how late it is, so you follow up on the right customers before small balances turn into bad debt.", path: "/billing/ar-aging", selector: "main h1" },
]

export const FLOWS: Record<string, Flow> = {
  overview: { id: "overview", label: "Full product tour", description: "The whole lifecycle, lead to invoice — the original demo tour.", steps: STEPS },
  scheduling: { id: "scheduling", label: "Scheduling jobs", description: "Lay out the week and turn service plans into jobs.", steps: scheduling },
  assigning: { id: "assigning", label: "Assigning cleaners", description: "Staff jobs and cover call-outs fast.", steps: assigning },
  tasks: { id: "tasks", label: "Completing & verifying tasks", description: "Task ownership, field execution, and supervisor verification.", steps: tasks },
  inspections: { id: "inspections", label: "Conducting inspections", description: "Score sites, schedule checks, and turn fails into fixes.", steps: inspections },
  complaints: { id: "complaints", label: "Handling complaints", description: "Investigate, attribute fairly, and resolve with corrective work.", steps: complaints },
  invoicing: { id: "invoicing", label: "Invoicing & payments", description: "Bill completed work, take payment, and chase AR.", steps: invoicing },
}

/** Flows offered in the Help → Guided Tutorials picker (overview last). */
export const TUTORIAL_FLOWS: Flow[] = [
  FLOWS.scheduling, FLOWS.assigning, FLOWS.tasks, FLOWS.inspections, FLOWS.complaints, FLOWS.invoicing, FLOWS.overview,
]
