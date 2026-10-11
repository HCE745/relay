// Guided demo tour — step definitions. Presentation only.
//
// Each step highlights a REAL, always-present element and explains, in a
// cleaning owner's language, what that screen does for them. We target stable
// anchors only — the dashboard attention tile, sidebar/list-row `href` links,
// and each page's single PageHeader <h1> — so no markup changes are needed and
// the checker (/demo/tour?check=1) can reliably assert every target.
//
// Detail pages use non-stable cuid ids, so detail-concept steps land on the
// LIST page and spotlight the first row (which the owner clicks through).
// `field: true` marks the phone field-app step, which an owner cannot navigate
// into — it shows as a centered explainer and the checker SKIPS it. `selector:
// null` renders a centered tooltip (whole-page / unreachable-screen steps).

export type Step = {
  title: string
  body: string
  path: string
  selector: string | null
  field?: boolean
}

export const STEPS: Step[] = [
  {
    title: "Your morning starts here",
    body: "Every day opens on this dashboard. The tiles up top show exactly what needs you right now — jobs with nobody assigned, failed inspections, time to approve. Clear these and your day is under control.",
    path: "/dashboard",
    selector: "a[href='/jobs?f=unassigned-today']",
  },
  {
    title: "A new lead came in",
    body: "Every prospect who calls or fills out your site lands here, with where they came from and where they are — new, contacted, quoted, won or lost. Nothing falls through the cracks.",
    path: "/leads",
    selector: "main h1",
  },
  {
    title: "Turn interest into a real number",
    body: "Open an estimate and the bid calculator works out a fair price from square footage, how often you clean, and your production rates — so you're not guessing on the quote.",
    path: "/estimates",
    selector: "a[href^='/estimates/']",
  },
  {
    title: "Win it — one click sets everything up",
    body: "When the customer says yes, converting the estimate creates the customer, their site, and the recurring service plan in one step. No re-typing what you already captured.",
    path: "/estimates",
    selector: "main h1",
  },
  {
    title: "The commercial agreement",
    body: "For contract work, this tracks the terms, the contract value, and how much you've invoiced against it — so you always know what's left on the agreement.",
    path: "/contracts",
    selector: "a[href^='/contracts/']",
  },
  {
    title: "What actually gets cleaned",
    body: "Open a customer and their site to see the scope of work — the checklist your crew follows, including which items need a proof photo. This is what shows up on their phone in the field.",
    path: "/customers",
    selector: "a[href^='/customers/']",
  },
  {
    title: "Set the recurring schedule",
    body: "Each site has a service plan — nightly, weekly, every other week — and the system rolls those out into real jobs on the calendar automatically. Set it once.",
    path: "/customers",
    selector: "main h1",
  },
  {
    title: "Your week at a glance",
    body: "The schedule lays out the week, color-coded by status. Anything still unassigned stands out so you can see the gaps before they become no-shows.",
    path: "/schedule",
    selector: "main h1",
  },
  {
    title: "Put a crew on the work",
    body: "Open any job to assign cleaners. The system knows who's available and who already works that site, so you staff it with the right people.",
    path: "/jobs",
    selector: "a[href^='/jobs/']",
  },
  {
    title: "Someone called out — fill it fast",
    body: "When a cleaner is out, their jobs show up here as uncovered. Find coverage suggests who can step in, and you reassign in a couple of taps — before the client ever notices.",
    path: "/coverage",
    selector: "main h1",
  },
  {
    title: "What your cleaners carry in their pocket",
    body: "On their phone, each cleaner sees today's jobs, the access notes, and the checklist. They clock in, work through the scope, snap the required proof photos, and clock out — all from the field.",
    path: "/jobs",
    selector: null,
    field: true,
  },
  {
    title: "What you see after the visit",
    body: "Back in the office, each job shows who worked it, when they clocked in and out, the proof photos, and any notes — a complete record of the visit.",
    path: "/jobs",
    selector: "main h1",
  },
  {
    title: "Check the quality",
    body: "Inspections score a site against your standard. A critical item failing flags the whole visit, so quality problems surface instead of hiding in an average.",
    path: "/inspections",
    selector: "a[href^='/inspections/']",
  },
  {
    title: "Catch and close problems",
    body: "A failed inspection or a field report becomes an issue you can track from raised to resolved — complaints and fixes don't live in someone's text messages.",
    path: "/issues",
    selector: "a[href^='/issues/']",
  },
  {
    title: "Approve the hours",
    body: "Clock-ins land here for your review. Fix an obvious mistake, then approve — and approved time is what flows into cost and payroll, so you're paying for real worked hours.",
    path: "/time",
    selector: "main h1",
  },
  {
    title: "Bill the work that got done",
    body: "Completed jobs turn into invoices automatically, and you can send a clean PDF to the customer. The money side follows the work without double entry.",
    path: "/billing/invoices",
    selector: "a[href^='/billing/invoices/']",
  },
  {
    title: "Know who owes you",
    body: "AR aging shows every unpaid invoice by how overdue it is, so you chase the right customers before small balances become bad debt.",
    path: "/billing/ar-aging",
    selector: "main h1",
  },
  {
    title: "Record the money coming in",
    body: "Log payments against invoices here. The invoice updates itself to paid or partially paid, so your receivables always match reality.",
    path: "/billing/payments",
    selector: "main h1",
  },
  {
    title: "Are you actually making money?",
    body: "Profitability puts revenue against labor and supplies for each site — so you see which accounts earn and which quietly bleed, instead of finding out at tax time.",
    path: "/reports/profitability",
    selector: "main h1",
  },
  {
    title: "What your customer sees",
    body: "Each customer can get a private portal to view their visits, proof photos and invoices — fewer status phone calls for you, and a professional face for them. You grant access from the customer's page.",
    path: "/customers",
    selector: null,
  },
  {
    title: "Your equipment",
    body: "Track vacuums, floor machines and other assets — where they are, who has them, and their service history — so a $3,000 machine doesn't just disappear.",
    path: "/assets",
    selector: "main h1",
  },
  {
    title: "Your supplies",
    body: "Keep an eye on chemical and paper stock, with low-stock flags so you reorder before a crew shows up empty-handed.",
    path: "/supplies",
    selector: "main h1",
  },
  {
    title: "Keep your crew compliant",
    body: "Track certifications, training and background checks with expiry dates, so you know everyone on site is cleared — before a client or auditor asks.",
    path: "/compliance",
    selector: "main h1",
  },
  {
    title: "Keys and access",
    body: "Record who holds keys, codes and alarm info for each site — controlled, logged, and not on a sticky note in a truck.",
    path: "/access",
    selector: "main h1",
  },
  {
    title: "Hire your next cleaner",
    body: "Post openings, take applications, and move people through to hired — and a hired applicant becomes an employee record in one step.",
    path: "/hiring",
    selector: "main h1",
  },
  {
    title: "Hand off to the accountant",
    body: "Export your financials and timekeeping as clean CSVs for QuickBooks, Xero, Gusto or ADP. The ERP runs operations; your accountant's tools do the books. That's the whole lifecycle — take it from here.",
    path: "/exports",
    selector: "main h1",
  },
]
