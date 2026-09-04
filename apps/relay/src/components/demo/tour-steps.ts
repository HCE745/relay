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
  audioFile?: string | null  // null = disable audio; undefined = use default path; string = custom path
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
    issue:           "tunnel conveyor stalled mid-cycle at Bay 2",
    dept:            "operations",
    title:           "Bay 2 tunnel conveyor stalled",
    desc:            "Tunnel conveyor stopped mid-cycle in Bay 2. Cars are backing up at the entrance. Attendant suspects a chain tension issue — chemical dosing pump also flagged low pressure this morning.",
    category:        "EQUIPMENT_BREAKDOWN",
    asset:           "Bay 2 Tunnel Conveyor",
    assetRecurring:  "tunnel conveyor or chemical dosing pump",
    vendorType:      "conveyor service technician or chemical systems contractor",
    qrLocations:     "each wash bay, the vacuum island, pay stations, and the chemical room",
    purchaseExample: "high-pressure nozzle set or detergent concentrate",
    openingLine:     "Bay 2 conveyor is stalled. The line is backing up.",
    location:        "site",
    worker:          "attendant",
    workerPlural:    "attendants",
    issueExamples:   ["conveyor jam", "vacuum coin jam", "pay station offline", "customer QR report"],
    closingLine:     "For car wash operators, that means faster response to conveyor failures, less vacuum downtime, and customer problems caught before they turn into bad reviews.",
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
      return `They start small: a missed handoff, an issue mentioned in passing but never documented, a repair scheduled but never confirmed. In ${locationPhrase}, that might mean a ${c.issueExamples[0]} that gets reported verbally during a shift change but never formally logged, and by the time it escalates, no one can trace when it started. Relay gives teams a shared system to make those problems visible and keep them moving toward resolution.`
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
      return `When problems are tracked across texts, emails, radios, and memory, managers spend their time chasing updates instead of solving them. This dashboard gives ${c.workerPlural} and leadership a single view of what is open, what is overdue, and what needs attention right now, without calls and without digging through messages.`
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
      return `${cap} notice problems before management does, but reporting usually depends on finding the right supervisor or hoping someone follows up. With Relay, anyone can document a ${c.issueExamples[0]} in seconds, with photos, location, and priority, and know the right person has been notified. Watch as we submit an example now.`
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
    path: "/dashboard",
    targetSelector: "[data-tour='kpi-cards']",
    getCue: () => "It appeared in the dashboard immediately, already assigned.",
    getTitle: () => "Issues route themselves. No manager required.",
    getExplain: () =>
      "Once reported, the issue does not sit in a queue waiting for someone to assign it. Relay routes it instantly to the right person based on location, department, and issue type. Response begins before anyone has to ask.",
  },

  // ── Step 5: Complete history ───────────────────────────────────────────────
  {
    id: 5,
    path: "SUBMITTED_ISSUE",
    targetSelector: "[data-tour='issue-detail']",
    cue: "Every action from here will be tracked automatically.",
    getTitle: () => "A complete record, from report to resolution.",
    getExplain: () =>
      "When problems get resolved through verbal updates, the resolution disappears with them. Relay keeps a complete record of every action: who reported it, who owned it, every status change, every comment. When the same issue comes back, the full history is already there.",
  },

  // ── Step 6: AI analysis ───────────────────────────────────────────────────
  {
    id: 6,
    path: "SUBMITTED_ISSUE",
    targetSelector: "[data-tour='ai-panel']",
    cue: "The AI analyzed this issue before anyone opened it.",
    getTitle: () => "AI analyzes the issue before your team does.",
    getExplain: () =>
      "Most issues get reviewed for the first time by the person resolving them, which means the same diagnostic steps happen over and over. Relay's AI suggests likely causes, recommended actions, and possible resolutions based on the description, the asset, and historical patterns. Your team still makes every decision, but from a better starting position.",
  },

  // ── Step 7: SOP connection ────────────────────────────────────────────────
  {
    id: 7,
    path: "/sops",
    targetSelector: "[data-tour='sop-list']",
    cue: "Relay flags when a reported issue may connect to one of these procedures.",
    getTitle: () => "Root cause, not just symptoms.",
    getExplain: (industry) => {
      const c = ind(industry)
      return `Some problems are symptoms of a missed procedure. When a ${c.issueExamples[0]} occurs repeatedly in the same area, it may indicate a gap in how the standard process is being followed, not a one-time failure. Relay can flag when a reported issue may be connected to an existing operating procedure, so teams address the root cause instead of simply closing the ticket.`
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
      return `When the same ${c.assetRecurring} keeps generating issues, treating each incident as isolated misses the pattern. Relay tracks the full history of every asset: every issue reported, every repair completed, every recurring failure, so teams can see whether a problem needs another repair or a replacement before it causes unplanned downtime.`
    },
  },

  // ── Step 9: Analytics ─────────────────────────────────────────────────────
  {
    id: 9,
    path: "/analytics",
    targetSelector: "[data-tour='analytics-charts']",
    getCue: (industry) => `Every issue your ${ind(industry).workerPlural} resolve builds this over time.`,
    getTitle: () => "Data in the moment. Intelligence over time.",
    getExplain: (industry) => {
      const c = ind(industry)
      const firstAsset = c.assetRecurring.split(" or ")[0]
      return `Which department generates the most issues? Which ${firstAsset} has the worst resolution time? Where are problems recurring? Relay turns issue history into answers, without requiring anyone to build a report.`
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
      "Relay can benchmark your resolution times, issue volume, and response rates against anonymized data from similar organizations, so you know where you stand and where there is room to improve. Based on operational data from real use, not self-reported surveys.",
  },

  // ── Step 11: QR reporting ─────────────────────────────────────────────────
  {
    id: 11,
    path: "/qr-codes",
    targetSelector: "[data-tour='qr-list']",
    cue: "Anyone can report a problem with no account and no app.",
    getTitle: () => "Report from anywhere in seconds.",
    getExplain: (industry) => {
      const c = ind(industry)
      return `Place a Relay QR code anywhere: ${c.qrLocations}. Anyone can scan and report a problem in seconds without an account or an app. The report goes directly to the right team and is automatically linked to that location or asset.`
    },
  },

  // ── Step 12: Vendor management ────────────────────────────────────────────
  {
    id: 12,
    path: "/vendors",
    targetSelector: "[data-tour='vendor-list'] > div:first-child",
    getCue: (industry) => `Your ${ind(industry).vendorType} stays connected to every issue.`,
    getTitle: () => "Vendors connected to the work, not buried in email.",
    getExplain: (industry) => {
      const c = ind(industry)
      return `When a problem requires an outside ${c.vendorType}, coordinating the response usually means phone calls, follow-up calls to confirm arrival, and hoping the right context made it through. Relay keeps vendor communication attached to the issue, so the full history travels with it and nothing gets lost between inboxes.`
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
      return `Replacing a ${c.purchaseExample} should not require the same process as a capital expenditure. Relay identifies the requested item, checks it against the approved catalog, and follows the organization's purchasing policy, approving routine requests automatically and escalating exceptions to the right approver.`
    },
  },

  // ── Step 14: Escalation + executive visibility ────────────────────────────
  {
    id: 14,
    path: "/dashboard",
    targetSelector: "[data-tour='kpi-cards']",
    cue: "Leadership always knows, without having to ask for a report.",
    getTitle: () => "Nothing stays stuck. Leadership always knows.",
    getExplain: () =>
      "Some issues stay unresolved not because no one cares, but because the responsible person is overloaded or a deadline slips unnoticed. Relay escalates automatically when response or resolution timelines are missed, moving the issue to the next management level with a full history of what has happened. Leadership gets a real-time view across every location without needing to ask.",
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
      return `When a ${c.issueExamples[0]} is reported, managers can create specific assignments for each person involved: shut down the equipment, contact the vendor, order the part. Every piece of work has a clear owner, a priority, a due date, and a direct link back to the issue that triggered it. Nothing gets lost, and nothing gets forgotten.`
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
      return `A ${c.worker} starting a shift should not have to ask what needs to get done. When they open Relay, they see exactly what is assigned to them: what is due today, what is overdue, what is urgent. A clear answer to the only question that matters: what do I need to do right now?`
    },
  },

  // ── Step 17: Employee Voice ───────────────────────────────────────────────
  {
    id: 17,
    path: "/voice",
    targetSelector: "[data-tour='voice-tiles']",
    getCue: (industry) => `${ind(industry).workerPlural.charAt(0).toUpperCase() + ind(industry).workerPlural.slice(1)} can share ideas, concerns, and feedback without needing a meeting.`,
    getTitle: () => "A channel for every kind of employee voice.",
    getExplain: (industry) => {
      const c = ind(industry)
      return `Problems surface in meetings. Ideas get mentioned and forgotten. Relay gives every ${c.worker} a direct channel: report an issue, make a suggestion, give feedback, share a concern, or take a quick survey. Managers see patterns over time, and employees know their voice is being heard. The best ideas often come from the people doing the work.`
    },
  },

  // ── Step 18: Announcements ────────────────────────────────────────────────
  {
    id: 18,
    path: "/communications/announcements",
    targetSelector: "[data-tour='announcements-list']",
    cue: "Critical information reaches the right people, and you know who got it.",
    getTitle: () => "Operational communications that leave no one in the dark.",
    getExplain: () =>
      "When a safety update or process change needs to reach everyone, email and radio do not guarantee it arrived. Relay broadcasts operational announcements to the entire organization, a specific location, or a single department. For critical communications, Relay tracks acknowledgment in real time, so you always know who has seen the message and who has not.",
  },

  // ── Step 19: Role cycling ─────────────────────────────────────────────────
  {
    id: 19,
    path: null,
    targetSelector: "[data-tour='role-switcher']",
    type: "cycling-roles",
    cue: "Every role gets exactly the view they need, nothing more.",
    getTitle: () => "Every role sees exactly what they need.",
    getExplain: (industry) => {
      const c = ind(industry)
      return `A ${c.worker} needs to know what to report and where to check status. A supervisor needs their team's queue. A manager needs department-wide visibility. An administrator needs full control over configuration. Relay adapts to each role automatically: one system, every level of the organization.`
    },
  },

  // ── Step 20: Industry cycling ─────────────────────────────────────────────
  {
    id: 20,
    path: "/dashboard",
    targetSelector: "[data-tour='industry-selector']",
    type: "cycling-industries",
    cue: "Watch how everything adapts to each type of operation.",
    getTitle: () => "Pre-configured for your industry from day one.",
    getExplain: () =>
      "Relay adapts to different types of operations: manufacturing plants, distribution centers, hospitality properties, retail locations, healthcare facilities, and more. The departments, terminology, issue categories, and workflows all reflect the selected environment, so the system feels like it was built for the operation it runs.",
  },

  // ── Step 21: Package cycling ──────────────────────────────────────────────
  {
    id: 21,
    path: null,
    targetSelector: "[data-tour='package-selector']",
    type: "cycling-packages",
    cue: "See exactly what each package includes.",
    getTitle: () => "Start simple. Unlock more as you grow.",
    getExplain: () =>
      "Essentials covers core issue tracking for a single location. Professional adds assets, vendors, multi-location support, and intelligence modules. Professional Plus adds executive visibility, regional management, and cross-location analytics. Choose the package that matches your operational needs today and expand as you grow.",
  },

  // ── Step 22: Completion ───────────────────────────────────────────────────
  {
    id: 22,
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
  { label: "Employee",           color: "bg-gray-600",   desc: "Simple submit-and-track: report issues, see status updates, no extra clutter." },
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

// ─── Car Wash tour (20 steps, audio disabled) ─────────────────────────────

export const CARWASH_TOUR_STEPS: TourStep[] = [
  // Step 1: Cinematic
  {
    id: 1,
    path: null,
    targetSelector: null,
    type: "cinematic",
    audioFile: "/demo-audio/carwash-step-01.mp3",
    getTitle: () => "Equipment goes down. Customers leave. No one knows until the next shift.",
    getExplain: () =>
      "Running a car wash means keeping every bay operational, responding to equipment failures before they cost revenue, and staying ahead of maintenance. The challenge is the same whether you run self-service stalls, in-bay automatics, or a tunnel: problems surface faster than communication does. Relay gives your team a shared operational system so nothing gets missed.",
  },

  // Step 2: Wash equipment status on dashboard
  {
    id: 2,
    path: "/dashboard",
    targetSelector: "[data-tour='carwash-equipment-status']",
    audioFile: "/demo-audio/carwash-step-02.mp3",
    cue: "This is what your team sees before the first car arrives.",
    getTitle: () => "Bay and equipment status — before the first car arrives.",
    getExplain: () =>
      "Your Wash Overview shows the current state of every bay and piece of equipment — which are operational, which are down, and which have open issues attached. Whether you run self-serve stalls, in-bay automatics, or a tunnel line, every piece of tracked equipment shows its current state. Managers see the morning situation without calling anyone.",
  },

  // Step 3: Customer reports panel on dashboard
  {
    id: 3,
    path: "/dashboard",
    targetSelector: "[data-tour='carwash-customer-reports']",
    audioFile: "/demo-audio/carwash-step-03.mp3",
    cue: "Customer reports come in directly — no phone call required.",
    getTitle: () => "Customer reports flow directly to your team.",
    getExplain: () =>
      "When a customer notices a blocked nozzle, a vacuum with no suction, or a pay station that rejected their card, they can report it in seconds from a QR code at the bay or station. The report goes directly to your team with the equipment and location already identified.",
  },

  // Step 4: QR codes
  {
    id: 4,
    path: "/qr-codes",
    targetSelector: "[data-tour='qr-list']",
    audioFile: "/demo-audio/carwash-step-04.mp3",
    cue: "Every bay, vacuum, and pay station can have its own code.",
    getTitle: () => "The QR code does the routing — they just describe the problem.",
    getExplain: () =>
      "Place a Relay QR code on each bay entrance, vacuum station, pay station, and chemical dispensing area. Customers scan the code, tap what went wrong, and submit — the report enters Relay with the location and equipment already identified. No account, no app, no friction.",
  },

  // Step 5: Issue form-fill
  {
    id: 5,
    path: "/issues/new",
    targetSelector: "[data-tour='issue-form']",
    audioFile: "/demo-audio/carwash-step-05.mp3",
    type: "form-fill",
    cue: "Your technician can log a problem from the floor just as quickly.",
    getTitle: () => "Staff report problems in seconds — from anywhere on site.",
    getExplain: () =>
      "Customers spot problems at the customer experience level. Technicians catch them at the equipment level. Watch as we log a high-pressure rinse issue on Bay 3 directly from the floor.",
    getFormData: () => ({
      title: "Bay 3 — high-pressure rinse not completing cycle",
      description: "Several customers reported that Bay 3 is not completing the rinse cycle. The arch appears to lose pressure midway through the wash. This may be a nozzle blockage or pump pressure issue affecting Bay 3 specifically.",
      category: "EQUIPMENT_BREAKDOWN",
    }),
  },

  // Step 6: Issue list
  {
    id: 6,
    path: "/issues",
    targetSelector: "[data-tour='issue-list']",
    audioFile: "/demo-audio/carwash-step-06.mp3",
    cue: "Customer reports and staff-logged issues, all in one unified queue.",
    getTitle: () => "All reports in one place. Nothing in a text thread.",
    getExplain: () =>
      "Customer QR reports and staff-logged issues appear together in the same queue. Every entry shows equipment, site, category, priority, and status. Managers see the full picture without checking multiple sources.",
  },

  // Step 7: SUBMITTED_ISSUE detail — assignment
  {
    id: 7,
    path: "SUBMITTED_ISSUE",
    targetSelector: "[data-tour='issue-detail-header']",
    audioFile: "/demo-audio/carwash-step-07.mp3",
    cue: "The report is already categorized and ready to assign.",
    getTitle: () => "Every problem has a clear owner immediately.",
    getExplain: () =>
      "Once logged, the issue shows who reported it, what equipment it affects, which site it belongs to, and its current status. Assign it to a technician in one tap — from this moment, the issue has an owner and a record that everyone can see.",
  },

  // Step 8: SUBMITTED_ISSUE AI panel
  {
    id: 8,
    path: "SUBMITTED_ISSUE",
    targetSelector: "[data-tour='ai-panel']",
    audioFile: "/demo-audio/carwash-step-08.mp3",
    cue: "Relay's AI can suggest what's likely wrong and how to respond.",
    getTitle: () => "AI analysis — before your technician arrives at the bay.",
    getExplain: () =>
      "For equipment issues, Relay's AI can suggest likely causes and recommended actions based on the description, the equipment type, and historical patterns. Your technician arrives at the bay with a starting point instead of starting from scratch.",
  },

  // Step 9: ESCALATED_ISSUE detail — context before showing timeline
  {
    id: 9,
    path: "ESCALATED_ISSUE",
    targetSelector: "[data-tour='issue-detail-header']",
    audioFile: "/demo-audio/carwash-step-09.mp3",
    cue: "Here's an issue that stayed open longer than it should have.",
    getTitle: () => "Critical failures get flagged — not buried.",
    getExplain: () =>
      "When a bay goes down, a pump fails, or a conveyor stalls, that issue is marked critical. The full record shows who reported it, when it was logged, what equipment is affected, and how long it has been open. Nothing disappears into a text thread.",
  },

  // Step 10: ESCALATED_ISSUE escalation timeline
  {
    id: 10,
    path: "ESCALATED_ISSUE",
    targetSelector: "[data-tour='escalation-timeline']",
    audioFile: "/demo-audio/carwash-step-10.mp3",
    cue: "When no one responds in time, Relay escalates automatically.",
    getTitle: () => "Problems that go unaddressed don't stay silent.",
    getExplain: () =>
      "If a technician misses the response window or a critical issue goes unresolved, Relay escalates automatically to the next management level — with the full timeline of what happened and how long it has been open. No manual follow-up required.",
  },

  // Step 11: Asset list
  {
    id: 11,
    path: "/assets",
    targetSelector: "[data-tour='asset-list']",
    audioFile: "/demo-audio/carwash-step-11.mp3",
    cue: "Every bay, pump, vacuum, and station is tracked here.",
    getTitle: () => "All equipment tracked in one system.",
    getExplain: () =>
      "Bays, vacuums, high-pressure pumps, RO systems, pay stations, and bill changers are all registered in Relay. Open issue counts show at a glance which equipment needs attention. Operators and managers see the same picture.",
  },

  // Step 12: FIRST_ASSET history
  {
    id: 12,
    path: "FIRST_ASSET",
    targetSelector: "[data-tour='asset-history']",
    audioFile: "/demo-audio/carwash-step-12.mp3",
    getCue: () => "Every piece of equipment builds its own maintenance record.",
    getTitle: () => "Equipment history — every issue, every repair, every visit.",
    getExplain: () =>
      "When the same bay or pump keeps generating problems, treating each incident as isolated misses the pattern. Relay tracks every issue, repair, and maintenance visit for each piece of equipment. Technicians and managers see whether something needs another repair or a replacement before it costs more downtime.",
  },

  // Step 13: Maintenance queue
  {
    id: 13,
    path: "/issues?category=MAINTENANCE",
    targetSelector: "[data-tour='issue-list']",
    audioFile: "/demo-audio/carwash-step-13.mp3",
    cue: "Routine maintenance stays visible alongside reactive repairs.",
    getTitle: () => "Stay ahead of maintenance — not behind it.",
    getExplain: () =>
      "Chemical line flushes, filter replacements, belt inspections, and pump lubrication stay visible in the same queue as reactive repairs. Nothing slips through because it was not urgent enough to remember.",
  },

  // Step 14: Vendors
  {
    id: 14,
    path: "/vendors",
    targetSelector: "[data-tour='vendor-list']",
    audioFile: "/demo-audio/carwash-step-14.mp3",
    cue: "Parts suppliers and service contractors stay connected to every issue.",
    getTitle: () => "Vendors connected to the work — not buried in a contact list.",
    getExplain: () =>
      "When a pump needs a specialist or a bay requires a replacement part, the relevant contractor is linked directly to the issue. The full context travels with every service call: what the problem is, what was tried, and the equipment's service history. No repeated explanations.",
  },

  // Step 15: Locations
  {
    id: 15,
    path: "/locations",
    targetSelector: "[data-tour='location-list']",
    audioFile: "/demo-audio/carwash-step-15.mp3",
    cue: "Each wash site is its own location — all visible in one system.",
    getTitle: () => "All your sites in one system.",
    getExplain: () =>
      "Relay brings every wash location into one view, whether you run self-service bays, in-bay automatics, or a tunnel. Open issues, equipment status, and maintenance tasks are organized by site. Managers see which locations need attention without traveling to each one.",
  },

  // Step 16: Assignments
  {
    id: 16,
    path: "/assignments",
    targetSelector: "[data-tour='assignment-list']",
    audioFile: "/demo-audio/carwash-step-16.mp3",
    cue: "Technicians see exactly what needs to get done — nothing missed.",
    getTitle: () => "One list. No hunting. Just the work.",
    getExplain: () =>
      "Every technician sees exactly what is assigned to them: which bay, what problem, what priority, what is due. No verbal handoffs, no texts that get missed. A technician starting a shift has a clear answer to the only question that matters: what do I need to do right now?",
  },

  // Step 17: Announcements
  {
    id: 17,
    path: "/communications/announcements",
    targetSelector: "[data-tour='announcements-list']",
    audioFile: "/demo-audio/carwash-step-17.mp3",
    cue: "Get a safety change or chemical update to every site immediately.",
    getTitle: () => "Critical communications reach every site at once.",
    getExplain: () =>
      "When a chemical procedure changes, a new safety requirement applies, or an equipment issue affects all sites, Relay broadcasts the announcement to every location's staff simultaneously. For critical communications, acknowledgment is tracked in real time — so you know who has seen it and who has not.",
  },

  // Step 18: Analytics
  {
    id: 18,
    path: "/analytics",
    targetSelector: "[data-tour='analytics-header']",
    audioFile: "/demo-audio/carwash-step-18.mp3",
    cue: "Every issue your team resolves builds this data over time.",
    getTitle: () => "The data that makes better maintenance decisions.",
    getExplain: () =>
      "Over time, Relay's history shows which equipment fails most often, which sites have the slowest response times, and where recurring problems concentrate. That gives operators better information for maintenance scheduling, equipment replacement decisions, and vendor evaluation.",
  },

  // Step 19: Employee Voice
  {
    id: 19,
    path: "/voice",
    targetSelector: "[data-tour='voice-tiles']",
    audioFile: "/demo-audio/carwash-step-19.mp3",
    cue: "Technicians can flag concerns and suggest improvements directly.",
    getTitle: () => "Give your team a direct channel.",
    getExplain: () =>
      "Technicians and site staff notice problems before management does. Relay gives every team member a channel to submit suggestions, share concerns, and complete quick surveys without a meeting. Managers see the patterns that surface across shifts and sites.",
  },

  // Step 20: Completion
  {
    id: 20,
    path: null,
    targetSelector: null,
    type: "completion",
    audioFile: "/demo-audio/carwash-step-20.mp3",
    getTitle: () => "That's Relay for Car Wash.",
    getExplain: () =>
      "Relay helps car wash operators replace fragmented communication with a shared operational system. Equipment problems are tracked the moment they happen. Technicians have clear tasks. Managers have visibility across every site — self-serve, in-bay automatic, or tunnel. Wash Essentials is available for smaller operations. Full Relay covers multi-site operators that need the complete operational platform. Start a free trial or schedule a demo to see it running at your wash.",
  },
]

// ─── Property Management tour (20 steps, audio disabled) ──────────────────

export const PROPERTY_MANAGEMENT_TOUR_STEPS: TourStep[] = [
  // Step 1: Cinematic
  {
    id: 1,
    path: null,
    targetSelector: null,
    type: "cinematic",
    audioFile: "/demo-audio/property-step-01.mp3",
    getTitle: () => "A tenant reported water coming through the ceiling. Three hours later, no one has responded.",
    getExplain: () =>
      "Managing a property portfolio means handling tenant requests, coordinating contractors, tracking equipment across multiple buildings, and staying ahead of maintenance. When communication happens over the phone, email, and memory, things fall through. Relay gives property teams a shared operational system so every request is tracked, every technician has a clear task, and every property manager has full visibility.",
  },

  // Step 2: Dashboard PM KPIs
  {
    id: 2,
    path: "/dashboard",
    targetSelector: "[data-tour='pm-kpi-cards']",
    audioFile: "/demo-audio/property-step-02.mp3",
    cue: "This is what your property team sees every morning.",
    getTitle: () => "Your property portfolio — everything that matters, immediately.",
    getExplain: () =>
      "The Property Overview shows open property issues, tenant requests received today, active maintenance work, equipment needing attention, and high-priority items requiring immediate action — no spreadsheets, no inbox digging.",
  },

  // Step 3: Dashboard PM equipment status
  {
    id: 3,
    path: "/dashboard",
    targetSelector: "[data-tour='pm-equipment-status']",
    audioFile: "/demo-audio/property-step-03.mp3",
    cue: "Building equipment status across all your properties.",
    getTitle: () => "Equipment health — across every building.",
    getExplain: () =>
      "HVAC systems, elevators, boilers, and fire suppression equipment across all buildings appear here with their current operational status. Equipment flagged as needing maintenance shows immediately — before a tenant reports a failure. Managers and maintenance supervisors see the same equipment picture.",
  },

  // Step 4: Dashboard PM tenant requests
  {
    id: 4,
    path: "/dashboard",
    targetSelector: "[data-tour='pm-tenant-requests']",
    audioFile: "/demo-audio/property-step-04.mp3",
    cue: "Tenant requests come in directly — no phone tag required.",
    getTitle: () => "Tenant requests flow directly to your team.",
    getExplain: () =>
      "Tenants submit requests by scanning a QR code in their unit, lobby, or common area. The request enters Relay immediately with the property, building, and location already identified — routed to the right maintenance team without a phone call or an email that gets buried.",
  },

  // Step 5: QR codes
  {
    id: 5,
    path: "/qr-codes",
    targetSelector: "[data-tour='qr-list']",
    audioFile: "/demo-audio/property-step-05.mp3",
    cue: "Each code is linked to a building, floor, or common area.",
    getTitle: () => "Tenants report problems in seconds — no account, no app.",
    getExplain: () =>
      "Place Relay QR codes in each unit entry, lobby, hallway, laundry room, and parking structure. Tenants scan, describe the issue, and submit — the request appears in Relay with the building and location already identified. Response begins before anyone has to make a phone call.",
  },

  // Step 6: Issue form-fill
  {
    id: 6,
    path: "/issues/new",
    targetSelector: "[data-tour='issue-form']",
    audioFile: "/demo-audio/property-step-06.mp3",
    type: "form-fill",
    cue: "Watch how a maintenance tech logs the ceiling water damage report.",
    getTitle: () => "Staff and tenants report the same way — in seconds.",
    getExplain: () =>
      "Maintenance staff can also log issues directly for the situations they discover themselves. Watch as we document the unit 4B ceiling water damage.",
    getFormData: () => ({
      title: "Unit 4B — water coming through the bathroom ceiling",
      description: "Tenant in unit 4B reported water dripping through the bathroom ceiling. Appears to originate from the unit above or from the roof. Damage started this morning. Ceiling tile is showing water staining and soft spots.",
      category: "FACILITY",
    }),
  },

  // Step 7: Issue list
  {
    id: 7,
    path: "/issues",
    targetSelector: "[data-tour='issue-list']",
    audioFile: "/demo-audio/property-step-07.mp3",
    cue: "Tenant requests and staff issues from across the portfolio, all in one queue.",
    getTitle: () => "Every request tracked. Nothing lost in email.",
    getExplain: () =>
      "Tenant requests, staff-logged issues, and maintenance work orders appear together in one queue. Each entry shows the property, building, category, priority, and status. Property managers and maintenance supervisors see the same view without multiple tools.",
  },

  // Step 8: SUBMITTED_ISSUE detail header
  {
    id: 8,
    path: "SUBMITTED_ISSUE",
    targetSelector: "[data-tour='issue-detail-header']",
    audioFile: "/demo-audio/property-step-08.mp3",
    cue: "Assign the right technician immediately — before the damage gets worse.",
    getTitle: () => "Every request has a clear owner within minutes.",
    getExplain: () =>
      "Once submitted, the issue shows who reported it, which property and unit it affects, what category it is, and its current status. Assign it to a maintenance technician or flag it for contractor dispatch — the record is visible to everyone on the team.",
  },

  // Step 9: SUBMITTED_ISSUE AI panel
  {
    id: 9,
    path: "SUBMITTED_ISSUE",
    targetSelector: "[data-tour='ai-panel']",
    audioFile: "/demo-audio/property-step-09.mp3",
    cue: "Relay's AI can identify the most likely source and response path.",
    getTitle: () => "AI helps narrow down the cause before the tech arrives.",
    getExplain: () =>
      "For maintenance issues like ceiling water damage, Relay's AI can analyze the description and suggest the most likely causes: roof penetration, plumbing from the unit above, or condensation, along with a recommended response approach. Technicians arrive at the unit with a starting point, not a blank page.",
  },

  // Step 10: ESCALATED_ISSUE detail header
  {
    id: 10,
    path: "ESCALATED_ISSUE",
    targetSelector: "[data-tour='issue-detail-header']",
    audioFile: "/demo-audio/property-step-10.mp3",
    cue: "Here's a critical issue that needed to reach management.",
    getTitle: () => "High-impact issues surface immediately — not after the fact.",
    getExplain: () =>
      "When a water damage issue or major equipment failure stays unresolved, the risk to the property and the tenant grows every hour. Relay gives these issues a visible, critical status so managers can see them immediately — not when someone finally loops them in.",
  },

  // Step 11: ESCALATED_ISSUE escalation timeline
  {
    id: 11,
    path: "ESCALATED_ISSUE",
    targetSelector: "[data-tour='escalation-timeline']",
    audioFile: "/demo-audio/property-step-11.mp3",
    cue: "When a contractor or tech misses the response window, Relay escalates.",
    getTitle: () => "No response? It escalates automatically.",
    getExplain: () =>
      "If a tenant issue is not addressed within the defined response window, Relay escalates automatically to the next management level — with the full timeline of what happened and how long the request has been open. Property managers have visibility without needing to manually follow up.",
  },

  // Step 12: Asset list
  {
    id: 12,
    path: "/assets",
    targetSelector: "[data-tour='asset-list']",
    audioFile: "/demo-audio/property-step-12.mp3",
    cue: "Every piece of building equipment tracked in one place.",
    getTitle: () => "All building equipment tracked across every property.",
    getExplain: () =>
      "HVAC units, elevators, boilers, fire suppression systems, electrical panels, and access control systems across every building are registered in Relay. Open issue counts are visible per asset. When a technician or contractor is dispatched, they have access to the full asset record.",
  },

  // Step 13: FIRST_ASSET history
  {
    id: 13,
    path: "FIRST_ASSET",
    targetSelector: "[data-tour='asset-history']",
    audioFile: "/demo-audio/property-step-13.mp3",
    getCue: () => "Every piece of equipment builds its own service history.",
    getTitle: () => "Equipment history — every issue, every inspection, every repair.",
    getExplain: () =>
      "When an HVAC unit, elevator, or boiler keeps generating requests, treating each incident as isolated misses the pattern. Relay tracks every issue, maintenance visit, and contractor service call per equipment record. Technicians and managers can see whether equipment needs another repair or is approaching end of life.",
  },

  // Step 14: Maintenance queue
  {
    id: 14,
    path: "/issues?category=MAINTENANCE",
    targetSelector: "[data-tour='issue-list']",
    audioFile: "/demo-audio/property-step-14.mp3",
    cue: "Scheduled maintenance stays visible alongside reactive tenant requests.",
    getTitle: () => "Maintenance queue — active work always in view.",
    getExplain: () =>
      "Filter maintenance work orders to see what is currently open, in progress, or waiting on a part or contractor. HVAC filter changes, fire suppression inspections, and elevator service stay in the same queue alongside reactive tenant requests. Nothing is tracked in a separate spreadsheet.",
  },

  // Step 15: Vendors
  {
    id: 15,
    path: "/vendors",
    targetSelector: "[data-tour='vendor-list']",
    audioFile: "/demo-audio/property-step-15.mp3",
    cue: "Every contractor in your portfolio — connected to the work.",
    getTitle: () => "Contractors connected to the work — not buried in a contact list.",
    getExplain: () =>
      "When a leak requires a plumber, a boiler issue requires a specialist, or a roof repair requires a contractor, Relay connects them directly to the work order. The issue description, property record, and equipment history travel with each service call. No repeated explanations over the phone.",
  },

  // Step 16: Locations
  {
    id: 16,
    path: "/locations",
    targetSelector: "[data-tour='location-list']",
    audioFile: "/demo-audio/property-step-16.mp3",
    cue: "Every property in your portfolio — all visible in one system.",
    getTitle: () => "All your properties in one system.",
    getExplain: () =>
      "Relay organizes your portfolio into properties, buildings, and areas so every issue, asset, and QR code is tied to the right location. Managers see which properties have open issues, which buildings have equipment down, and where maintenance teams are focused — across the entire portfolio.",
  },

  // Step 17: Assignments
  {
    id: 17,
    path: "/assignments",
    targetSelector: "[data-tour='assignment-list']",
    audioFile: "/demo-audio/property-step-17.mp3",
    cue: "Technicians always know what's on their plate and where.",
    getTitle: () => "Maintenance technicians have a clear daily work order.",
    getExplain: () =>
      "Every maintenance technician sees exactly what is assigned to them: which property, which unit, what problem, what priority, what is due. No verbal handoffs at shift change, no missed requests. A technician starting their day has a complete answer to what needs to get done.",
  },

  // Step 18: Analytics
  {
    id: 18,
    path: "/analytics",
    targetSelector: "[data-tour='analytics-header']",
    audioFile: "/demo-audio/property-step-18.mp3",
    cue: "Every resolved request builds this data over time.",
    getTitle: () => "The data that drives better property decisions.",
    getExplain: () =>
      "Relay's history shows which properties generate the most requests, which equipment keeps failing, which contractors are slowest to respond, and how quickly maintenance teams close tickets. That data supports better decisions on maintenance budgets, equipment replacement, and contractor evaluation.",
  },

  // Step 19: Employee Voice
  {
    id: 19,
    path: "/voice",
    targetSelector: "[data-tour='voice-tiles']",
    audioFile: "/demo-audio/property-step-19.mp3",
    cue: "Maintenance staff can surface process gaps and suggestions directly.",
    getTitle: () => "Give your maintenance team a direct channel.",
    getExplain: () =>
      "Maintenance technicians notice recurring problems before property managers do — equipment that keeps failing, contractor coordination gaps, process improvements. Relay gives every team member a channel to submit ideas, flag concerns, and complete quick surveys. Managers see the patterns that emerge across the portfolio.",
  },

  // Step 20: Completion
  {
    id: 20,
    path: null,
    targetSelector: null,
    type: "completion",
    audioFile: "/demo-audio/property-step-20.mp3",
    getTitle: () => "That's Relay for Property Management.",
    getExplain: () =>
      "Relay helps property management teams replace scattered communication with a shared operational system. Tenants have a clear way to report problems. Maintenance staff have clear assignments. Managers have visibility across every property. That means faster contractor response, better tenant communication, and a complete work order history across your portfolio. Start a free trial or schedule a demo to see it in your operation.",
  },
]

// ─── Manufacturing tour (21 steps) ───────────────────────────────────────────

export const MANUFACTURING_TOUR_STEPS: TourStep[] = [
  // Step 1: Cinematic
  {
    id: 1,
    path: null,
    targetSelector: null,
    type: "cinematic",
    audioFile: "/demo-audio/manufacturing-step-01.mp3",
    getTitle: () => "A machine on Line 3 went down. An operator mentioned it at shift change. It never got logged.",
    getExplain: () =>
      "Keeping equipment running, coordinating maintenance, managing safety procedures, and knowing what is happening across every plant and line — when any of these depend on verbal handoffs or text messages, problems disappear between shifts. Relay gives manufacturing teams a shared operational system so every equipment failure is tracked, every maintenance tech has a clear task, and plant managers have real-time visibility across every location.",
  },

  // Step 2: Plant Overview KPIs
  {
    id: 2,
    path: "/dashboard",
    targetSelector: "[data-tour='kpi-cards']",
    audioFile: "/demo-audio/manufacturing-step-02.mp3",
    cue: "This is what your team sees the moment a shift starts.",
    getTitle: () => "Plant operations at a glance — before the first part ships.",
    getExplain: () =>
      "The Plant Overview shows equipment currently down, open safety issues, pending maintenance, high-priority items, and machines available for production — the critical numbers before a shift starts. Supervisors and managers see the same picture without a radio call.",
  },

  // Step 3: Machine Status
  {
    id: 3,
    path: "/dashboard",
    targetSelector: "[data-tour='mfg-machine-status']",
    audioFile: "/demo-audio/manufacturing-step-03.mp3",
    cue: "Every machine your plant tracks shows its current state here.",
    getTitle: () => "Machine status — operational, down, or in maintenance.",
    getExplain: () =>
      "The Machine Status board shows every tracked piece of equipment and its current state: operational, down, or in scheduled maintenance, with open issue counts attached to each machine. Maintenance supervisors see which machines need attention before they walk the floor.",
  },

  // Step 4: Recent breakdowns
  {
    id: 4,
    path: "/dashboard",
    targetSelector: "[data-tour='mfg-recent-breakdowns']",
    audioFile: "/demo-audio/manufacturing-step-04.mp3",
    cue: "Every equipment breakdown lands here the moment it's reported.",
    getTitle: () => "Equipment issues tracked the moment they happen.",
    getExplain: () =>
      "Machine faults, breakdowns, and safety issues are logged the moment they occur — through the app, through a QR code on the machine, or by a technician directly. Each entry is time-stamped, linked to the specific asset, and visible to maintenance supervisors immediately, not at the next shift meeting.",
  },

  // Step 5: Issue form-fill
  {
    id: 5,
    path: "/issues/new",
    targetSelector: "[data-tour='issue-form']",
    audioFile: "/demo-audio/manufacturing-step-05.mp3",
    type: "form-fill",
    cue: "This is how any operator logs a problem — from a breakdown to a safety concern.",
    getTitle: () => "Any operator can log a problem in seconds.",
    getExplain: () =>
      "Machine noise, spindle vibration, quality defect, safety hazard — any team member can log it from their phone or a QR code in seconds. Watch as we log a CNC spindle vibration issue.",
    getFormData: () => ({
      title: "CNC Machine #3 — spindle vibration at high RPM",
      description: "Spindle vibrating noticeably above 8,000 RPM. Operator has slowed the machine to 4,000 RPM as a precaution. Quality check on recent parts recommended.",
      category: "EQUIPMENT_BREAKDOWN",
    }),
  },

  // Step 6: Issue list
  {
    id: 6,
    path: "/issues",
    targetSelector: "[data-tour='issue-list']",
    audioFile: "/demo-audio/manufacturing-step-06.mp3",
    cue: "Every issue across all lines and departments, tracked in one queue.",
    getTitle: () => "Every issue tracked, assigned, and visible.",
    getExplain: () =>
      "Machine breakdowns, safety incidents, quality flags, and maintenance requests appear together in one queue, organized by priority and status. Maintenance supervisors see the full picture across lines and departments without checking multiple systems or calling multiple supervisors.",
  },

  // Step 7: SUBMITTED_ISSUE detail header
  {
    id: 7,
    path: "SUBMITTED_ISSUE",
    targetSelector: "[data-tour='issue-detail-header']",
    audioFile: "/demo-audio/manufacturing-step-07.mp3",
    cue: "The issue is already categorized and ready to assign.",
    getTitle: () => "Every issue has a clear owner immediately.",
    getExplain: () =>
      "Once logged, the issue shows who reported it, which machine it affects, the category and priority, and its current status. Assign it to the right maintenance technician in one step — no manager phone call required. The response begins before the end of the current shift.",
  },

  // Step 8: SUBMITTED_ISSUE AI panel
  {
    id: 8,
    path: "SUBMITTED_ISSUE",
    targetSelector: "[data-tour='ai-panel']",
    audioFile: "/demo-audio/manufacturing-step-08.mp3",
    cue: "Relay's AI can suggest likely causes and a response approach.",
    getTitle: () => "AI analysis — before the maintenance tech arrives at the machine.",
    getExplain: () =>
      "For equipment issues, Relay's AI can analyze the description, the machine type, and historical patterns to suggest likely causes and recommended actions. A maintenance technician assigned to a spindle vibration issue arrives with a starting point — not a blank page.",
  },

  // Step 9: SUBMITTED_ISSUE SOP panel
  {
    id: 9,
    path: "SUBMITTED_ISSUE",
    targetSelector: "[data-tour='sop-panel']",
    audioFile: "/demo-audio/manufacturing-step-09.mp3",
    cue: "Safety procedures can be linked directly to the work order.",
    getTitle: () => "Safety procedures attached to the work — not in a binder.",
    getExplain: () =>
      "When a CNC machine is flagged for a breakdown, the LOTO checklist, lockout steps, and inspection protocol can be linked directly to that issue. Maintenance technicians see the required procedure right alongside the problem description. Nothing gets skipped because the binder was in the wrong building.",
  },

  // Step 10: ESCALATED_ISSUE detail header
  {
    id: 10,
    path: "ESCALATED_ISSUE",
    targetSelector: "[data-tour='issue-detail-header']",
    audioFile: "/demo-audio/manufacturing-step-10.mp3",
    cue: "Here's a production-critical failure that required management escalation.",
    getTitle: () => "Production-impact failures are flagged — not buried.",
    getExplain: () =>
      "When a hydraulic press, conveyor, or machining center fails completely, that issue is marked critical and treated differently from a routine maintenance request. The full record shows who reported it, which machine it affects, how long it has been open, and what production is impacted — visible to management immediately.",
  },

  // Step 11: ESCALATED_ISSUE escalation timeline
  {
    id: 11,
    path: "ESCALATED_ISSUE",
    targetSelector: "[data-tour='escalation-timeline']",
    audioFile: "/demo-audio/manufacturing-step-11.mp3",
    cue: "When an issue goes unresolved, Relay escalates automatically.",
    getTitle: () => "Production-impact issues don't wait for the next shift meeting.",
    getExplain: () =>
      "When a critical equipment failure is not addressed within the response window, Relay escalates automatically to the plant manager or the next management level — with the full record of what happened and how long production has been affected. No one has to manually chase the issue up the chain.",
  },

  // Step 12: Asset list
  {
    id: 12,
    path: "/assets",
    targetSelector: "[data-tour='asset-list']",
    audioFile: "/demo-audio/manufacturing-step-12.mp3",
    cue: "Every machine and piece of production equipment is tracked here.",
    getTitle: () => "All machines and equipment tracked in one system.",
    getExplain: () =>
      "CNC machining centers, conveyors, hydraulic presses, welding robots, overhead cranes, laser cutters, air compressors, and utility systems across every plant are registered in Relay. Open issue counts are visible per machine. Maintenance planners see which equipment needs the most attention across the operation.",
  },

  // Step 13: FIRST_ASSET history
  {
    id: 13,
    path: "FIRST_ASSET",
    targetSelector: "[data-tour='asset-history']",
    audioFile: "/demo-audio/manufacturing-step-13.mp3",
    getCue: () => "Every machine builds its own complete maintenance history.",
    getTitle: () => "Equipment history — every breakdown, every service, every repair.",
    getExplain: () =>
      "When the same conveyor, press, or CNC keeps generating issues, treating each incident as isolated misses the pattern. Relay tracks every issue, maintenance visit, repair, and service call per machine. Supervisors and engineers can see whether equipment needs another repair, scheduled maintenance, or a replacement evaluation.",
  },

  // Step 14: QR codes — fixed selector (qr-list, not qr-code-list)
  {
    id: 14,
    path: "/qr-codes",
    targetSelector: "[data-tour='qr-list']",
    audioFile: "/demo-audio/manufacturing-step-14.mp3",
    cue: "Operators report machine problems without leaving the production line.",
    getTitle: () => "QR codes on every machine — report without leaving the floor.",
    getExplain: () =>
      "Place a Relay QR code on each CNC machine, conveyor station, press, and work cell. Operators scan and describe what is wrong. The report enters Relay linked to that specific machine — no app login, no station to walk to. Breakdowns get logged the moment they happen, not at the end of the shift.",
  },

  // Step 15: SOPs library
  {
    id: 15,
    path: "/sops",
    targetSelector: "[data-tour='sop-list']",
    audioFile: "/demo-audio/manufacturing-step-15.mp3",
    cue: "Every safety procedure, inspection checklist, and LOTO protocol — centralized.",
    getTitle: () => "SOPs centralized and searchable — not buried in a binder.",
    getExplain: () =>
      "Safety procedures, LOTO lockout/tagout checklists, machine-specific inspection protocols, and maintenance SOPs are stored in Relay where your team actually works. When an issue is linked to a procedure, the SOP surfaces directly from the issue. Managers can see which SOPs are connected to recurring problems.",
  },

  // Step 16: Vendors
  {
    id: 16,
    path: "/vendors",
    targetSelector: "[data-tour='vendor-list']",
    audioFile: "/demo-audio/manufacturing-step-16.mp3",
    cue: "Specialty repair contractors stay connected to every machine issue.",
    getTitle: () => "Specialist contractors connected to the work.",
    getExplain: () =>
      "When a CNC machine requires a factory service technician, or a hydraulic press needs a specialist repair, the contractor is linked directly to the relevant issue with the full equipment history and problem description. No repeated explanations, no lost context between calls.",
  },

  // Step 17: Locations
  {
    id: 17,
    path: "/locations",
    targetSelector: "[data-tour='location-list']",
    audioFile: "/demo-audio/manufacturing-step-17.mp3",
    cue: "Each plant is its own location — all visible in one system.",
    getTitle: () => "All your plants in one system.",
    getExplain: () =>
      "Relay organizes operations into plants, lines, and areas so every issue, machine, and QR code is tied to the right location. Plant managers and operations directors see which facilities have open equipment failures, which lines are running with active issues, and where maintenance teams are focused — across every location.",
  },

  // Step 18: Assignments
  {
    id: 18,
    path: "/assignments",
    targetSelector: "[data-tour='assignment-list']",
    audioFile: "/demo-audio/manufacturing-step-18.mp3",
    cue: "Maintenance technicians have a clear task list every shift.",
    getTitle: () => "Every maintenance task has a clear owner and deadline.",
    getExplain: () =>
      "When an equipment issue is logged, managers can create specific assignments: isolate the machine, order the part, run a quality check on recent output, notify the line supervisor. Every piece of work has a clear owner, a priority, and a link back to the issue that triggered it. Nothing gets lost between shifts.",
  },

  // Step 19: Analytics
  {
    id: 19,
    path: "/analytics",
    targetSelector: "[data-tour='analytics-header']",
    audioFile: "/demo-audio/manufacturing-step-19.mp3",
    cue: "Every issue your team resolves builds this data over time.",
    getTitle: () => "Equipment reliability and maintenance data — across every plant.",
    getExplain: () =>
      "Relay's history shows which machines fail most often, which categories of issues take longest to resolve, and where recurring breakdowns concentrate across plants and lines. That data informs maintenance schedules, parts stocking decisions, capital equipment planning, and supplier evaluation.",
  },

  // Step 20: Employee Voice
  {
    id: 20,
    path: "/voice",
    targetSelector: "[data-tour='voice-tiles']",
    audioFile: "/demo-audio/manufacturing-step-20.mp3",
    cue: "Operators surface near-misses and process gaps before they become incidents.",
    getTitle: () => "The people on the floor see problems first.",
    getExplain: () =>
      "Operators notice machine inefficiencies, near-misses, and quality issues before they appear in the data. Relay gives every team member a direct channel to submit a concern, suggest an improvement, or complete a quick safety survey. Managers see the patterns that emerge across shifts and plants — the kind of operational intelligence that does not show up in maintenance logs.",
  },

  // Step 21: Completion
  {
    id: 21,
    path: null,
    targetSelector: null,
    type: "completion",
    audioFile: "/demo-audio/manufacturing-step-21.mp3",
    getTitle: () => "That's Relay for Manufacturing.",
    getExplain: () =>
      "Relay helps manufacturing teams replace fragmented communication with a shared operational system. Equipment problems are tracked the moment they happen. Maintenance technicians have clear tasks. Plant managers have visibility across every plant and line. That means faster response to breakdowns, fewer issues lost between shifts, and a complete maintenance record for every machine. Start a free trial or schedule a demo to see it in your operation.",
  },
]

export function getActiveTourSteps(industry: string): TourStep[] {
  if (industry === "Car Wash") return CARWASH_TOUR_STEPS
  if (industry === "Property Management") return PROPERTY_MANAGEMENT_TOUR_STEPS
  if (industry === "Manufacturing") return MANUFACTURING_TOUR_STEPS
  return TOUR_STEPS
}

export function getNumTourSteps(industry: string): number {
  return getActiveTourSteps(industry).length
}
