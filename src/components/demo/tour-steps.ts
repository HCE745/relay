export interface TourStep {
  id: number
  path: string | null
  targetSelector: string | null
  cue?: string
  getCue?: (industry: string) => string
  getTitle: (industry: string) => string
  getExplain: (industry: string) => string
  type?: "cinematic" | "cycling-roles" | "cycling-industries" | "cycling-packages" | "form-fill" | "completion" | "auto-click-benchmarks" | "feature-grid"
  getFormData?: (industry: string) => { title: string; description: string; category: string }
}

// ─── Industry content ──────────────────────────────────────────────────────────

interface IndustryContent {
  issue:           string
  dept:            string
  title:           string
  desc:            string
  category:        string
  asset:           string
  assetRecurring:  string
  vendorType:      string
  qrLocations:     string
  purchaseExample: string
  openingLine:     string
  location:        string
  worker:          string
  workerPlural:    string
  issueExamples:   [string, string, string, string]
  closingLine:     string
}

const INDUSTRY_CONTENT: Record<string, IndustryContent> = {
  Manufacturing: {
    issue:           "hydraulic fluid leak near Line 2",
    dept:            "production",
    title:           "Conveyor leaking hydraulic fluid near Line 2",
    desc:            "Noticed hydraulic fluid pooling under the main conveyor drive unit. Line has been slowed as a precaution.",
    category:        "EQUIPMENT_BREAKDOWN",
    asset:           "Main Drive Conveyor",
    assetRecurring:  "conveyor or hydraulic press",
    vendorType:      "equipment supplier or hydraulic service contractor",
    qrLocations:     "each conveyor station, the hydraulic room, Dock Bay 3, and each CNC machine",
    purchaseExample: "conveyor belt or hydraulic seal kit",
    openingLine:     "A machine fault just appeared on Line 2.",
    location:        "plant",
    worker:          "operator",
    workerPlural:    "operators",
    issueExamples:   ["hydraulic leak", "machine fault", "quality defect", "missed shift handoff"],
    closingLine:     "For manufacturers, that means fewer problems lost between shifts, clearer maintenance coordination, and earlier visibility into the issues contributing to downtime or quality loss.",
  },

  Warehousing: {
    issue:           "dock door failure at Bay 7",
    dept:            "shipping and receiving",
    title:           "Dock door 7 not closing correctly",
    desc:            "Dock door 7 is not closing or sealing correctly. Shipment in bay 3 is delayed. Reported at start of shift.",
    category:        "FACILITY",
    asset:           "Dock Door 7",
    assetRecurring:  "dock door or forklift",
    vendorType:      "door repair contractor or forklift service provider",
    qrLocations:     "each dock door, the forklift charging bay, cold storage entry, and the loading dock",
    purchaseExample: "dock door seal or forklift battery",
    openingLine:     "Dock door 7 is not closing. A shipment is sitting in bay 3.",
    location:        "facility",
    worker:          "associate",
    workerPlural:    "associates",
    issueExamples:   ["damaged inventory", "blocked aisle", "dock door failure", "safety hazard"],
    closingLine:     "For warehouses, that means clearer coordination around safety, inventory, equipment, and fulfillment operations.",
  },

  "Property Management": {
    issue:           "roof leak in unit 4B",
    dept:            "maintenance",
    title:           "Roof leak reported in unit 4B",
    desc:            "Tenant in unit 4B reported water coming through the ceiling. Leak appears to be above the bathroom.",
    category:        "FACILITY",
    asset:           "Unit 4B Roof",
    assetRecurring:  "roofing system or HVAC unit",
    vendorType:      "roofing contractor or plumber",
    qrLocations:     "the building entrance, each floor maintenance closet, laundry room, and the parking structure",
    purchaseExample: "roofing patch kit or pipe repair coupling",
    openingLine:     "A tenant in unit 4B has water coming through the ceiling.",
    location:        "property",
    worker:          "technician",
    workerPlural:    "technicians",
    issueExamples:   ["roof leak", "HVAC failure", "vendor no-show", "inspection finding"],
    closingLine:     "For property managers, that means faster vendor response, better tenant communication, and complete work order history.",
  },

  Hospitality: {
    issue:           "guest room heating failure",
    dept:            "housekeeping",
    title:           "Heating system not functioning in Room 214",
    desc:            "Guest in room 214 reporting heating system not functioning. Housekeeping confirmed unit is not producing heat.",
    category:        "MAINTENANCE",
    asset:           "Room 214 HVAC Unit",
    assetRecurring:  "HVAC unit or elevator",
    vendorType:      "HVAC contractor or elevator service company",
    qrLocations:     "each guest room, the elevator lobby, pool mechanical room, and the laundry area",
    purchaseExample: "AC filter replacement or elevator inspection kit",
    openingLine:     "A guest in room 214 says the heat is not working.",
    location:        "property",
    worker:          "associate",
    workerPlural:    "associates",
    issueExamples:   ["room maintenance issue", "guest-impacting equipment failure", "housekeeping delay", "engineering request"],
    closingLine:     "For hospitality operations, that means better coordination between departments before issues affect the guest experience.",
  },

  Retail: {
    issue:           "POS system offline at register 3",
    dept:            "store operations",
    title:           "POS system offline at register 3",
    desc:            "POS terminal at register 3 is offline. Customer service queue is building at the checkout lane.",
    category:        "EQUIPMENT_BREAKDOWN",
    asset:           "POS Terminal 3",
    assetRecurring:  "POS terminal or aisle cooler",
    vendorType:      "POS service provider or refrigeration contractor",
    qrLocations:     "checkout lanes, aisle coolers, the stock room, and the customer service desk",
    purchaseExample: "POS receipt paper roll or cooler door gasket",
    openingLine:     "POS terminal at register 3 is offline. The checkout line is growing.",
    location:        "store",
    worker:          "associate",
    workerPlural:    "associates",
    issueExamples:   ["POS offline", "safety hazard", "equipment failure", "multi-location visibility gap"],
    closingLine:     "For multi-location retail, that means consistent issue handling across every store and visibility into which locations need attention.",
  },

  "Car Wash": {
    issue:           "pressure washer losing pressure in Bay 3",
    dept:            "operations",
    title:           "Bay 3 pressure washer losing pressure",
    desc:            "Bay 3 pressure washer is losing pressure mid-cycle. Customers are cycling through the bay manually. Issue started at shift start.",
    category:        "EQUIPMENT_BREAKDOWN",
    asset:           "Bay 3 Pressure Washer",
    assetRecurring:  "pressure washer or conveyor belt",
    vendorType:      "equipment service contractor or chemical supplier",
    qrLocations:     "each wash bay, the equipment room, chemical storage, and the entrance kiosk",
    purchaseExample: "pressure washer nozzle or chemical concentrate",
    openingLine:     "Bay 3 is down. Cars are backing up.",
    location:        "site",
    worker:          "attendant",
    workerPlural:    "attendants",
    issueExamples:   ["bay down", "equipment failure", "chemical shortage", "site needing attention"],
    closingLine:     "For car wash operators, that means faster response to equipment failures, clearer site accountability, and less downtime.",
  },

  Healthcare: {
    issue:           "HVAC failure in the east patient wing",
    dept:            "facilities",
    title:           "HVAC unit not functioning in patient wing",
    desc:            "HVAC unit in the east patient wing is not functioning. Temperature is rising. Facilities notified.",
    category:        "FACILITY",
    asset:           "Patient Wing HVAC Unit",
    assetRecurring:  "HVAC unit or patient-area equipment",
    vendorType:      "HVAC contractor or biomedical equipment service",
    qrLocations:     "patient rooms, the mechanical room, the ICU corridor, and the emergency department entrance",
    purchaseExample: "HVAC filter or medical cart battery",
    openingLine:     "The HVAC unit in the patient wing is down. Temperature is rising.",
    location:        "facility",
    worker:          "staff member",
    workerPlural:    "staff",
    issueExamples:   ["HVAC issue in patient area", "equipment malfunction", "facility safety concern", "compliance issue"],
    closingLine:     "For healthcare facilities, that means faster resolution of facility issues, better compliance documentation, and clearer maintenance accountability.",
  },

  Construction: {
    issue:           "hydraulic leak on excavator at Job Site B",
    dept:            "field operations",
    title:           "Excavator hydraulic leak on Job Site B",
    desc:            "Excavator on Job Site B has a hydraulic leak near the boom cylinder. Equipment has been shut down as a precaution.",
    category:        "EQUIPMENT_BREAKDOWN",
    asset:           "Excavator Unit 4",
    assetRecurring:  "excavator or crane",
    vendorType:      "equipment repair contractor or materials supplier",
    qrLocations:     "each job site trailer, the equipment staging area, materials storage, and the site entrance",
    purchaseExample: "hydraulic hose or safety harness replacement",
    openingLine:     "An excavator is down on Job Site B. Work has stopped.",
    location:        "job site",
    worker:          "crew member",
    workerPlural:    "crew members",
    issueExamples:   ["equipment breakdown", "safety incident", "material shortage", "subcontractor issue"],
    closingLine:     "For construction operations, that means clearer coordination across job sites, faster equipment issue response, and better subcontractor accountability.",
  },

  Other: {
    issue:           "equipment malfunction at the main location",
    dept:            "operations",
    title:           "Equipment issue reported at main location",
    desc:            "Equipment malfunction observed during routine operations. Area has been flagged and the team has been notified.",
    category:        "EQUIPMENT_BREAKDOWN",
    asset:           "Main Equipment Unit",
    assetRecurring:  "primary equipment or support system",
    vendorType:      "service contractor or equipment provider",
    qrLocations:     "the main work area, equipment rooms, storage areas, and the entrance",
    purchaseExample: "replacement part or maintenance supply",
    openingLine:     "An operational issue just came in.",
    location:        "location",
    worker:          "employee",
    workerPlural:    "employees",
    issueExamples:   ["equipment issue", "safety concern", "facilities problem", "process breakdown"],
    closingLine:     "Relay can be configured around the departments, locations, workflows, and operational problems that matter most to your organization.",
  },
}

// Maps full template labels (stored in DB) back to INDUSTRY_CONTENT keys
const FULL_LABEL_TO_KEY: Record<string, string> = {
  "Warehousing & Distribution":     "Warehousing",
  "Retail (Multi-Location)":        "Retail",
  "Hospitality & Hotels":           "Hospitality",
  "Healthcare Facilities":          "Healthcare",
  "Property & Facility Management": "Property Management",
}

function ind(industry: string): IndustryContent {
  const key = FULL_LABEL_TO_KEY[industry] ?? industry
  return INDUSTRY_CONTENT[key] ?? INDUSTRY_CONTENT["Manufacturing"]
}

// ─── Tour steps ────────────────────────────────────────────────────────────────

export const TOUR_STEPS: TourStep[] = [
  // ── Step 1: Opening (cinematic) ────────────────────────────────────────────
  {
    id: 1,
    path: null,
    targetSelector: null,
    type: "cinematic",
    getTitle: () => "Operational problems rarely start big.",
    getExplain: (industry) => {
      const c = ind(industry)
      const locationPhrase = c.location === "location" ? "many operations" : `a ${c.location}`
      return `They start small — a missed handoff, an issue mentioned in passing but never documented, a repair scheduled but never confirmed. In ${locationPhrase}, that might mean a ${c.issueExamples[0]} that gets reported verbally during a shift change but never formally logged — and by the time it escalates, no one can trace when it started. Relay gives teams a shared system to make those problems visible and keep them moving toward resolution.`
    },
  },

  // ── Step 2: Dashboard ──────────────────────────────────────────────────────
  {
    id: 2,
    path: "/dashboard",
    targetSelector: "[data-tour='kpi-cards']",
    getCue: (industry) => `This is what ${ind(industry).workerPlural} and managers see every morning.`,
    getTitle: () => "One view. No more chasing updates.",
    getExplain: (industry) => {
      const c = ind(industry)
      return `When problems are tracked across texts, emails, radios, and memory, managers spend their time chasing updates instead of solving them. This dashboard gives ${c.workerPlural} and leadership a single view of what is open, what is overdue, and what needs attention right now — without calls, without digging through messages.`
    },
  },

  // ── Step 3: Report the issue (form-fill) ──────────────────────────────────
  {
    id: 3,
    path: "/issues/new",
    targetSelector: "[data-tour='issue-form']",
    type: "form-fill",
    getCue: (industry) => `Watch how quickly a ${ind(industry).worker} can report a ${ind(industry).issueExamples[0]}.`,
    getTitle: () => "Anyone can report a problem in seconds.",
    getExplain: (industry) => {
      const c = ind(industry)
      const cap = c.workerPlural.charAt(0).toUpperCase() + c.workerPlural.slice(1)
      return `${cap} notice problems before management does — but reporting usually depends on finding the right supervisor or hoping someone follows up. With Relay, anyone can document a ${c.issueExamples[0]} in seconds — with photos, location, and priority — and know the right person has been notified. Watch as we submit an example now.`
    },
    getFormData: (industry) => ({
      title:       ind(industry).title,
      description: ind(industry).desc,
      category:    ind(industry).category,
    }),
  },

  // ── Step 4: Automatic routing ─────────────────────────────────────────────
  {
    id: 4,
    path: "SUBMITTED_ISSUE",
    targetSelector: "[data-tour='issue-detail']",
    cue: "The right person was notified before anyone made a call.",
    getTitle: () => "Issues route themselves — no manager required.",
    getExplain: () =>
      "Once reported, the issue does not sit in a queue waiting for someone to assign it. Relay routes it instantly to the right person based on location, department, and issue type. Response begins before anyone has to ask.",
  },

  // ── Step 5: Complete history ───────────────────────────────────────────────
  {
    id: 5,
    path: "SUBMITTED_ISSUE",
    targetSelector: "[data-tour='issue-detail']",
    cue: "Every action from here will be tracked automatically.",
    getTitle: () => "A complete record — from report to resolution.",
    getExplain: () =>
      "When problems get resolved through verbal updates, the resolution disappears with them. Relay keeps a complete record of every action — who reported it, who owned it, every status change, every comment. When the same issue comes back, the full history is already there.",
  },

  // ── Step 6: AI analysis ───────────────────────────────────────────────────
  {
    id: 6,
    path: "SUBMITTED_ISSUE",
    targetSelector: "[data-tour='ai-panel']",
    cue: "The AI has already analyzed this issue — before anyone opened it.",
    getTitle: () => "AI analyzes the issue before your team does.",
    getExplain: () =>
      "Most issues get reviewed for the first time by the person resolving them — which means the same diagnostic steps happen over and over. Relay's AI suggests likely causes, recommended actions, and possible resolutions based on the description, the asset, and historical patterns. Your team still makes every decision — they just start from a better position.",
  },

  // ── Step 7: SOP connection ────────────────────────────────────────────────
  {
    id: 7,
    path: "SUBMITTED_ISSUE",
    targetSelector: "[data-tour='ai-panel']",
    cue: "Relay flags when a procedure may have been missed.",
    getTitle: () => "Root cause, not just symptoms.",
    getExplain: (industry) => {
      const c = ind(industry)
      return `Some problems are symptoms of a missed procedure. When a ${c.issueExamples[0]} occurs repeatedly in the same area, it may indicate a gap in how the standard process is being followed — not just a one-time failure. Relay can flag when a reported issue may be connected to an existing operating procedure, so teams address the root cause instead of simply closing the ticket.`
    },
  },

  // ── Step 8: Asset history ─────────────────────────────────────────────────
  {
    id: 8,
    path: "FIRST_ASSET",
    targetSelector: "[data-tour='asset-history']",
    getCue: (industry) => `See the full maintenance history for this ${ind(industry).assetRecurring.split(" or ")[0]}.`,
    getTitle: () => "Every asset tells its own story.",
    getExplain: (industry) => {
      const c = ind(industry)
      return `When the same ${c.assetRecurring} keeps generating issues, treating each incident as isolated misses the pattern. Relay tracks the full history of every asset — every issue reported, every repair completed, every recurring failure — so teams can see whether a problem needs another repair or a replacement before it causes unplanned downtime.`
    },
  },

  // ── Step 9: Analytics ─────────────────────────────────────────────────────
  {
    id: 9,
    path: "/analytics",
    targetSelector: "[data-tour='analytics-charts']",
    getCue: (industry) => `Every issue your ${ind(industry).workerPlural} resolve builds this over time.`,
    getTitle: () => "Data in the moment — intelligence over time.",
    getExplain: (industry) => {
      const c = ind(industry)
      const firstAsset = c.assetRecurring.split(" or ")[0]
      return `Which department generates the most issues? Which ${firstAsset} has the worst resolution time? Where are problems recurring? Relay turns issue history into answers — without requiring anyone to build a report.`
    },
  },

  // ── Step 10: Benchmarks ───────────────────────────────────────────────────
  {
    id: 10,
    path: "/analytics",
    targetSelector: "[data-tour='benchmarks-panel']",
    type: "auto-click-benchmarks",
    cue: "See how your operation compares to similar organizations.",
    getTitle: () => "How does your operation compare?",
    getExplain: () =>
      "Relay can benchmark your resolution times, issue volume, and response rates against anonymized data from similar organizations — so you know where you stand and where there is room to improve. Based on operational data from real use, not self-reported surveys.",
  },

  // ── Step 11: QR reporting ─────────────────────────────────────────────────
  {
    id: 11,
    path: "/qr-codes",
    targetSelector: "[data-tour='qr-list']",
    cue: "Anyone can report a problem — no account, no app.",
    getTitle: () => "Report from anywhere in seconds.",
    getExplain: (industry) => {
      const c = ind(industry)
      return `Place a Relay QR code anywhere — ${c.qrLocations}. Anyone can scan and report a problem in seconds without an account or an app. The report goes directly to the right team and is automatically linked to that location or asset.`
    },
  },

  // ── Step 12: Vendor management ────────────────────────────────────────────
  {
    id: 12,
    path: "/vendors",
    targetSelector: "[data-tour='vendor-list'] > div:first-child",
    getCue: (industry) => `Your ${ind(industry).vendorType} stays connected to every issue.`,
    getTitle: () => "Vendors connected to the work — not buried in email.",
    getExplain: (industry) => {
      const c = ind(industry)
      return `When a problem requires an outside ${c.vendorType}, coordinating the response usually means phone calls, follow-up calls to confirm arrival, and hoping the right context made it through. Relay keeps vendor communication attached to the issue — so the full history travels with it and nothing gets lost between inboxes.`
    },
  },

  // ── Step 13: Purchase intelligence ───────────────────────────────────────
  {
    id: 13,
    path: "/purchase-requests",
    targetSelector: "[data-tour='purchase-intelligence']",
    getCue: (industry) => `Watch how a ${ind(industry).purchaseExample} request gets handled automatically.`,
    getTitle: () => "Routine approvals run themselves.",
    getExplain: (industry) => {
      const c = ind(industry)
      return `Replacing a ${c.purchaseExample} should not require the same process as a capital expenditure. Relay identifies the requested item, checks it against the approved catalog, and follows the organization's purchasing policy — approving routine requests automatically and escalating exceptions to the right approver.`
    },
  },

  // ── Step 14: Escalation + executive visibility ────────────────────────────
  {
    id: 14,
    path: "/dashboard",
    targetSelector: "[data-tour='kpi-cards']",
    cue: "Leadership always knows — without having to ask for a report.",
    getTitle: () => "Nothing stays stuck. Leadership always knows.",
    getExplain: () =>
      "Some issues stay unresolved not because no one cares — but because the responsible person is overloaded or a deadline slips unnoticed. Relay escalates automatically when response or resolution timelines are missed, moving the issue to the next management level with a full history of what has happened. Leadership gets a real-time view across every location without needing to ask.",
  },

  // ── Step 15: Assignments ──────────────────────────────────────────────────
  {
    id: 15,
    path: "/assignments",
    targetSelector: "[data-tour='assignment-list']",
    cue: "Issues identify problems. Assignments turn them into work.",
    getTitle: () => "Every problem becomes a clear work order.",
    getExplain: (industry) => {
      const c = ind(industry)
      return `When a ${c.issueExamples[0]} is reported, managers can create specific assignments for each person involved — shut down the equipment, contact the vendor, order the part. Every piece of work has a clear owner, a priority, a due date, and a direct link back to the issue that triggered it. Nothing gets lost, and nothing gets forgotten.`
    },
  },

  // ── Step 16: My Work (employee view) ─────────────────────────────────────
  {
    id: 16,
    path: "/assignments",
    targetSelector: "[data-tour='assignment-list']",
    getCue: (industry) => `A ${ind(industry).worker} starting their shift sees exactly what needs to get done.`,
    getTitle: () => "One screen. No hunting. Just their work.",
    getExplain: (industry) => {
      const c = ind(industry)
      return `A ${c.worker} starting a shift should not have to ask what needs to get done. When they open Relay, they see exactly what is assigned to them — what is due today, what is overdue, what is urgent. A clear answer to the only question that matters: what do I need to do right now?`
    },
  },

  // ── Step 17: Announcements ────────────────────────────────────────────────
  {
    id: 17,
    path: "/communications/announcements",
    targetSelector: "[data-tour='announcements-list']",
    cue: "Critical information reaches the right people — and you know who got it.",
    getTitle: () => "Operational communications that leave no one in the dark.",
    getExplain: () =>
      "When a safety update or process change needs to reach everyone, email and radio do not guarantee it arrived. Relay broadcasts operational announcements to the entire organization, a specific location, or a single department. For critical communications, Relay tracks acknowledgment in real time — so you always know who has seen the message and who has not.",
  },

  // ── Step 18: Role cycling ─────────────────────────────────────────────────
  {
    id: 18,
    path: null,
    targetSelector: "[data-tour='role-switcher']",
    type: "cycling-roles",
    cue: "Every role gets exactly the view they need — nothing more.",
    getTitle: () => "Every role sees exactly what they need.",
    getExplain: (industry) => {
      const c = ind(industry)
      return `A ${c.worker} needs to know what to report and where to check status. A supervisor needs their team's queue. A manager needs department-wide visibility. An administrator needs full control over configuration. Relay adapts to each role automatically — one system, every level of the organization.`
    },
  },

  // ── Step 19: Industry cycling ─────────────────────────────────────────────
  {
    id: 19,
    path: "/dashboard",
    targetSelector: "[data-tour='industry-selector']",
    type: "cycling-industries",
    cue: "Watch how everything adapts to each type of operation.",
    getTitle: () => "Pre-configured for your industry from day one.",
    getExplain: () =>
      "Relay adapts to different types of operations — manufacturing plants, distribution centers, hospitality properties, retail locations, healthcare facilities, and more. The departments, terminology, issue categories, and workflows all reflect the selected environment — so the system feels like it was built for the operation it runs.",
  },

  // ── Step 20: Package cycling ──────────────────────────────────────────────
  {
    id: 20,
    path: null,
    targetSelector: "[data-tour='package-selector']",
    type: "cycling-packages",
    cue: "See exactly what each package includes.",
    getTitle: () => "Start simple. Unlock more as you grow.",
    getExplain: () =>
      "Essentials covers core issue tracking for a single location. Professional adds assets, vendors, multi-location support, and intelligence modules. Professional Plus adds executive visibility, regional management, and cross-location analytics. Choose the package that matches your operational needs today and expand as you grow.",
  },

  // ── Step 21: Completion ───────────────────────────────────────────────────
  {
    id: 21,
    path: null,
    targetSelector: null,
    type: "completion",
    getTitle: () => "That's Relay — every issue owned, every action tracked.",
    getExplain: (industry) => {
      const c = ind(industry)
      return `Relay helps organizations replace fragmented workarounds with a shared operational system. Employees have a clear way to report problems. Managers have ownership and accountability. Leadership has visibility. ${c.closingLine} Continue exploring, start a free trial, or schedule a demo.`
    },
  },
]

export const ROLE_DEMOS = [
  { label: "Employee",           color: "bg-gray-600",   desc: "Simple submit-and-track — report issues, see status updates, no extra clutter." },
  { label: "Supervisor",         color: "bg-teal-600",   desc: "Team issue queue, department metrics, and first-level escalation management." },
  { label: "Department Manager", color: "bg-blue-600",   desc: "Full department analytics, escalations, team performance, and approval flows." },
  { label: "Plant Manager",      color: "bg-orange-600", desc: "Location-wide visibility, cross-department KPIs, and site-level approvals." },
  { label: "Administrator",      color: "bg-purple-600", desc: "Complete organizational control — settings, routing rules, users, and all modules." },
]

export const INDUSTRY_DEMOS = [
  { label: "Manufacturing",      emoji: "🏭", desc: "Conveyor systems, CNC machines, hydraulic presses, and production line operations." },
  { label: "Warehousing",        emoji: "📦", desc: "Dock doors, forklifts, damaged inventory, and shipping and receiving workflows." },
  { label: "Hospitality",        emoji: "🏨", desc: "Guest rooms, HVAC, elevators, housekeeping, and front-of-house service." },
  { label: "Car Wash",           emoji: "🚗", desc: "Wash bays, chemical systems, conveyor equipment, and site operations." },
  { label: "Construction",       emoji: "🏗️", desc: "Job site equipment, safety incidents, subcontractor coordination, and field operations." },
]

export const PACKAGE_DEMOS = [
  {
    label: "Essentials",
    color: "bg-gray-600",
    tier: 0,
    features: [
      { text: "Issue tracking & lifecycle",  included: true  },
      { text: "Photo uploads",               included: true  },
      { text: "Team management",             included: true  },
      { text: "Location & department org",   included: true  },
      { text: "AI Issue Intelligence",       included: false },
      { text: "Asset & vendor management",   included: false },
      { text: "QR code reporting",           included: false },
      { text: "Benchmarking & briefings",    included: false },
    ],
    best: "Small teams getting started",
  },
  {
    label: "Professional",
    color: "bg-blue-600",
    tier: 1,
    features: [
      { text: "Issue tracking & lifecycle",  included: true  },
      { text: "Photo uploads",               included: true  },
      { text: "Team management",             included: true  },
      { text: "Location & department org",   included: true  },
      { text: "AI Issue Intelligence",       included: true  },
      { text: "Asset & vendor management",   included: true  },
      { text: "QR code reporting",           included: true  },
      { text: "Benchmarking & briefings",    included: false },
    ],
    best: "Growing operations",
  },
  {
    label: "Professional Plus",
    color: "bg-purple-600",
    tier: 2,
    features: [
      { text: "Issue tracking & lifecycle",  included: true },
      { text: "Photo uploads",               included: true },
      { text: "Team management",             included: true },
      { text: "Location & department org",   included: true },
      { text: "AI Issue Intelligence",       included: true },
      { text: "Asset & vendor management",   included: true },
      { text: "QR code reporting",           included: true },
      { text: "Benchmarking & briefings",    included: true },
    ],
    best: "Enterprise & multi-site",
  },
]

export const ADDITIONAL_FEATURES = [
  { emoji: "📋", title: "SOP Management",            desc: "Auto-detects compliance gaps in real time" },
  { emoji: "🚨", title: "Injury Reporting",           desc: "Auto-escalation with regulatory logging" },
  { emoji: "🤝", title: "External Collaborators",     desc: "Contractor & vendor portal access" },
  { emoji: "🏢", title: "Shared Facility Support",    desc: "Multi-company operations in one space" },
  { emoji: "📊", title: "Executive AI Briefings",     desc: "Weekly automated performance summaries" },
  { emoji: "❤️", title: "Operational Health Scores",  desc: "Real-time facility health scoring" },
  { emoji: "🔔", title: "AI Trend Detection",         desc: "Pattern recognition before problems repeat" },
  { emoji: "🔗", title: "API & Webhooks",             desc: "Connect your existing tools" },
]
