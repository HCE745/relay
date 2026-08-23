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

// ─── Car Wash tour (12 steps, audio disabled) ──────────────────────────────

export const CARWASH_TOUR_STEPS: TourStep[] = [
  // Step 1: Opening (cinematic)
  // Narration 1: matches — no route/selector needed
  {
    id: 1,
    path: null,
    targetSelector: null,
    type: "cinematic",
    audioFile: "/demo-audio/carwash-step-01.mp3",
    getTitle: () => "Your wash site is running. Something just broke.",
    getExplain: () =>
      "Running a car wash means keeping equipment running, responding to customer problems, and staying ahead of maintenance. Relay puts all of that in one place so issues do not disappear into texts, calls, or memory.",
  },

  // Step 2: Equipment status on dashboard
  // data-tour="carwash-equipment-status" confirmed exists on dashboard page
  {
    id: 2,
    path: "/dashboard",
    targetSelector: "[data-tour='carwash-equipment-status']",
    audioFile: "/demo-audio/carwash-step-02.mp3",
    cue: "This is what your team sees every morning before the first car arrives.",
    getTitle: () => "Your Wash Overview — everything that matters, immediately.",
    getExplain: () =>
      "Your Wash Overview shows what matters immediately — which bays are operating, what equipment is down, customer reports today, and open maintenance. You can see where attention is needed without digging through the system.",
  },

  // Step 3: Customer reports panel on dashboard
  // data-tour="carwash-customer-reports" confirmed exists on dashboard page
  {
    id: 3,
    path: "/dashboard",
    targetSelector: "[data-tour='carwash-customer-reports']",
    audioFile: "/demo-audio/carwash-step-03.mp3",
    cue: "Customers can report a problem at any bay without an account or an app.",
    getTitle: () => "Customer reports flow directly here.",
    getExplain: () =>
      "Customers often notice equipment problems first. Relay lets them scan a QR code on a bay, vacuum, or other equipment and report the problem in seconds — no login and no app required.",
  },

  // Step 4: QR codes page — admin view of scannable codes
  // data-tour="qr-list" confirmed exists on /qr-codes page
  {
    id: 4,
    path: "/qr-codes",
    targetSelector: "[data-tour='qr-list']",
    audioFile: "/demo-audio/carwash-step-04.mp3",
    cue: "Each code is already linked to a location or piece of equipment.",
    getTitle: () => "The QR code does the work — customers just describe the problem.",
    getExplain: () =>
      "The QR code already identifies the wash, location, and equipment. The customer simply chooses what went wrong, adds details if needed, and submits the report directly to your operation.",
  },

  // Step 5: Issues list — report appears in Relay
  // data-tour="issue-list" confirmed exists on /issues page
  {
    id: 5,
    path: "/issues",
    targetSelector: "[data-tour='issue-list']",
    audioFile: "/demo-audio/carwash-step-05.mp3",
    cue: "Every report your team receives shows up here.",
    getTitle: () => "The report appears in Relay immediately.",
    getExplain: () =>
      "The report appears inside Relay with the equipment, site, time, and problem already attached. Your team immediately knows what happened and where.",
  },

  // Step 6: Issue detail header — assignment
  // Uses FIRST_ISSUE (pre-seeded issue with assignee) so the assignee field is populated
  {
    id: 6,
    path: "FIRST_ISSUE",
    targetSelector: "[data-tour='issue-detail-header']",
    audioFile: "/demo-audio/carwash-step-06.mp3",
    cue: "Assign it to the person responsible for handling it.",
    getTitle: () => "Every problem has a clear owner.",
    getExplain: () =>
      "Assign the problem to the person responsible for handling it. Relay gives every issue a clear owner so managers can see what is being worked on and what still needs attention.",
  },

  // Step 7: Issue detail header — lifecycle
  // Same FIRST_ISSUE page, different narration — targets header not comments
  {
    id: 7,
    path: "FIRST_ISSUE",
    targetSelector: "[data-tour='issue-detail-header']",
    audioFile: "/demo-audio/carwash-step-07.mp3",
    cue: "Status, notes, and photos all stay attached to the same record.",
    getTitle: () => "One record, visible to everyone — no chasing updates.",
    getExplain: () =>
      "As the problem is handled, your team can update its status, add notes and photos, and document the resolution. Everyone sees the same record instead of chasing updates.",
  },

  // Step 8: Asset history
  // Narration 8: "Each piece of equipment builds a history of its problems and repairs."
  // Truthful: FIRST_ASSET → /assets/[id] → [data-tour='asset-history'] shows full issue history per asset
  {
    id: 8,
    path: "FIRST_ASSET",
    targetSelector: "[data-tour='asset-history']",
    audioFile: "/demo-audio/carwash-step-08.mp3",
    getCue: () => "Every piece of equipment keeps its own history.",
    getTitle: () => "Every piece of equipment builds its own record.",
    getExplain: () =>
      "Each piece of equipment builds a history of its problems and repairs. That makes recurring failures easier to spot and gives you context before the next service visit.",
  },

  // Step 9: Maintenance issues view
  // Narration 9: "stay ahead of recurring maintenance instead of waiting for equipment to fail"
  // Truthful: /issues?category=MAINTENANCE shows open maintenance tasks — keeping routine service visible
  // Does NOT claim PM scheduling (not yet implemented)
  {
    id: 9,
    path: "/issues?category=MAINTENANCE",
    targetSelector: "[data-tour='issue-list']",
    audioFile: "/demo-audio/carwash-step-09.mp3",
    cue: "Open maintenance tasks stay visible so nothing slips through.",
    getTitle: () => "Stay ahead of maintenance — not behind it.",
    getExplain: () =>
      "Relay also helps you stay ahead of recurring maintenance instead of waiting for equipment to fail. Keep routine service visible and make sure required maintenance does not get forgotten.",
  },

  // Step 10: Locations
  // Narration 10: "For operators with several washes..."
  // Truthful: /locations + location-list shows sites with issue/asset counts
  {
    id: 10,
    path: "/locations",
    targetSelector: "[data-tour='location-list']",
    audioFile: "/demo-audio/carwash-step-10.mp3",
    cue: "Each wash site is its own location, with its own issues and equipment.",
    getTitle: () => "All your sites in one system.",
    getExplain: () =>
      "For operators with several washes, Relay brings each location into one view. You can quickly see which sites have open issues and where equipment needs attention.",
  },

  // Step 11: Analytics — data-tour="analytics-header" added to analytics page outer div
  {
    id: 11,
    path: "/analytics",
    targetSelector: "[data-tour='analytics-header']",
    audioFile: "/demo-audio/carwash-step-11.mp3",
    cue: "Every issue your team resolves builds this over time.",
    getTitle: () => "The data that makes better maintenance decisions.",
    getExplain: () =>
      "Over time, the history in Relay shows which equipment causes the most problems, where issues keep recurring, and how quickly they get resolved. That gives you better information for maintenance and replacement decisions.",
  },

  // Step 12: Completion
  // Narration 12: "Wash Essentials for smaller operators, full Relay Wash Edition for larger"
  // Note: "Relay Wash Edition" is user-provided terminology; product in code is "Full Relay"
  {
    id: 12,
    path: null,
    targetSelector: null,
    type: "completion",
    audioFile: "/demo-audio/carwash-step-12.mp3",
    getTitle: () => "That's Relay for Car Wash.",
    getExplain: () =>
      "Wash Essentials is designed for smaller car-wash operators that need a simple way to manage equipment problems, maintenance, and customer reports. Larger organizations can use Full Relay for advanced teams, workflows, routing, and operational coordination. Start a free trial or schedule a demo to see it in your operation.",
  },
]

// ─── Property Management tour (12 steps) ──────────────────────────────────

export const PROPERTY_MANAGEMENT_TOUR_STEPS: TourStep[] = [
  // Step 1: Opening (cinematic)
  {
    id: 1,
    path: null,
    targetSelector: null,
    type: "cinematic",
    audioFile: "/demo-audio/pm-step-01.mp3",
    getTitle: () => "A tenant just called. There's water coming through the ceiling.",
    getExplain: () =>
      "Managing properties means handling tenant issues, coordinating contractors, tracking equipment, and keeping every building running — across multiple properties at once. Relay puts all of it in one place so nothing falls through the cracks.",
  },

  // Step 2: Property Overview dashboard
  {
    id: 2,
    path: "/dashboard",
    targetSelector: "[data-tour='pm-kpi-cards']",
    audioFile: "/demo-audio/pm-step-02.mp3",
    cue: "This is what your property team sees every morning.",
    getTitle: () => "Your Property Overview — everything that matters, immediately.",
    getExplain: () =>
      "Your Property Overview shows what matters at a glance — open property issues, tenant requests today, active maintenance work, and equipment that needs attention. You can see where to focus without opening a single email or spreadsheet.",
  },

  // Step 3: Tenant requests panel
  {
    id: 3,
    path: "/dashboard",
    targetSelector: "[data-tour='pm-tenant-requests']",
    audioFile: "/demo-audio/pm-step-03.mp3",
    cue: "Tenant requests come in directly — no phone tag required.",
    getTitle: () => "Tenant requests flow directly to your team.",
    getExplain: () =>
      "Tenants scan a QR code in their unit, the lobby, or a common area and describe the problem in seconds. The request goes directly to the right team, attached to the right property, with no calls to chase it down.",
  },

  // Step 4: QR codes page
  {
    id: 4,
    path: "/qr-codes",
    targetSelector: "[data-tour='qr-list']",
    audioFile: "/demo-audio/pm-step-04.mp3",
    cue: "Each code is already linked to a building, floor, or common area.",
    getTitle: () => "The QR code handles the routing — tenants just describe the issue.",
    getExplain: () =>
      "Place a Relay QR code at the building entrance, each floor maintenance closet, the laundry room, or the parking structure. The code already identifies the property and location — tenants choose what went wrong and submit, with no account or app required.",
  },

  // Step 5: Issues list — request appears
  {
    id: 5,
    path: "/issues",
    targetSelector: "[data-tour='issue-list']",
    audioFile: "/demo-audio/pm-step-05.mp3",
    cue: "Every request your team receives shows up here.",
    getTitle: () => "The request appears in Relay immediately.",
    getExplain: () =>
      "The request appears inside Relay with the property, location, time, and description already attached. Your team immediately knows what came in and where it needs to go.",
  },

  // Step 6: Issue detail — ownership
  {
    id: 6,
    path: "FIRST_ISSUE",
    targetSelector: "[data-tour='issue-detail-header']",
    audioFile: "/demo-audio/pm-step-06.mp3",
    cue: "Assign it to the right technician or contractor immediately.",
    getTitle: () => "Every problem has a clear owner.",
    getExplain: () =>
      "Assign the issue to a maintenance technician, schedule a contractor, or flag it for follow-up. Relay gives every problem a clear owner so managers always know what is being handled and what is still waiting.",
  },

  // Step 7: Maintenance queue — active work, no scheduling claim
  {
    id: 7,
    path: "/issues?category=MAINTENANCE",
    targetSelector: "[data-tour='issue-list']",
    audioFile: "/demo-audio/pm-step-07.mp3",
    cue: "Open maintenance work stays visible so nothing slips through.",
    getTitle: () => "Maintenance queue — active work always in view.",
    getExplain: () =>
      "Active maintenance work across all properties is visible in one queue. Your team can see what is open, what is in progress, and what is waiting on a part or a contractor — without digging through emails or asking around.",
  },

  // Step 8: Asset history
  {
    id: 8,
    path: "FIRST_ASSET",
    targetSelector: "[data-tour='asset-history']",
    audioFile: "/demo-audio/pm-step-08.mp3",
    getCue: () => "Every piece of equipment keeps its own service history.",
    getTitle: () => "Every piece of equipment builds its own record.",
    getExplain: () =>
      "Each HVAC unit, boiler, elevator, and fire suppression system builds a history of its problems and service visits. When a contractor arrives, the full history is already there — so they spend less time diagnosing and more time fixing.",
  },

  // Step 9: Properties / hierarchy
  {
    id: 9,
    path: "/locations",
    targetSelector: "[data-tour='location-list']",
    audioFile: "/demo-audio/pm-step-09.mp3",
    cue: "Each property is its own location, with its own buildings, issues, and equipment.",
    getTitle: () => "All your properties in one system.",
    getExplain: () =>
      "Relay organizes your portfolio into properties and buildings so every issue, asset, and QR code is tied to the right location. You can quickly see which properties have open issues and where attention is needed across your entire portfolio.",
  },

  // Step 10: Analytics / reports
  {
    id: 10,
    path: "/analytics",
    targetSelector: "[data-tour='analytics-header']",
    audioFile: "/demo-audio/pm-step-10.mp3",
    cue: "Every issue your team resolves builds this over time.",
    getTitle: () => "The data that drives better property decisions.",
    getExplain: () =>
      "Over time, the history in Relay shows which properties generate the most issues, which equipment keeps failing, and how quickly your team resolves problems. That gives you better information for maintenance decisions, vendor evaluation, and capital planning.",
  },

  // Step 11: Contractor coordination
  {
    id: 11,
    path: "/vendors",
    targetSelector: "[data-tour='vendor-list'] > div:first-child",
    audioFile: "/demo-audio/pm-step-11.mp3",
    cue: "Your roofing contractor, plumber, and HVAC vendor are all connected to the work.",
    getTitle: () => "Contractors connected to the work — not buried in email.",
    getExplain: () =>
      "When a problem requires an outside roofing contractor or plumber, coordinating the response usually means phone calls, follow-up calls, and hoping the right context made it through. Relay keeps contractor communication attached to the issue so the full history travels with it and nothing gets lost between inboxes.",
  },

  // Step 12: Employee Voice
  {
    id: 12,
    path: "/voice",
    targetSelector: "[data-tour='voice-tiles']",
    cue: "Technicians and staff can share ideas and concerns without needing a meeting.",
    getTitle: () => "Give your maintenance team a voice.",
    getExplain: () =>
      "Your technicians notice problems before management does — recurring issues, process gaps, safety concerns. Relay gives every team member a direct channel to submit suggestions, share feedback, and take surveys. Managers see the patterns. The people doing the work feel heard.",
  },

  // Step 13: Completion
  {
    id: 13,
    path: null,
    targetSelector: null,
    type: "completion",
    audioFile: "/demo-audio/pm-step-12.mp3",
    getTitle: () => "That's Relay for Property Management.",
    getExplain: () =>
      "Relay helps property management teams replace scattered communication with a shared operational system. Tenants have a clear way to report problems. Maintenance staff have clear assignments. Managers have visibility across every property. That means faster contractor response, better tenant communication, and a complete record of every issue across your portfolio. Start a free trial or schedule a demo to see it in your operation.",
  },
]

// ─── Manufacturing tour (12 steps, all audioFile: null) ───────────────────────

export const MANUFACTURING_TOUR_STEPS: TourStep[] = [
  // Step 1: Opening (cinematic)
  {
    id: 1,
    path: null,
    targetSelector: null,
    type: "cinematic",
    audioFile: null,
    getTitle: () => "A machine just went down. Production is halted.",
    getExplain: () =>
      "Running a manufacturing facility means keeping equipment online, coordinating maintenance, tracking safety issues, and knowing what's happening across every plant and line. Relay puts all of it in one place so problems get resolved instead of getting lost.",
  },

  // Step 2: Plant Overview dashboard KPIs
  {
    id: 2,
    path: "/dashboard",
    targetSelector: "[data-tour='kpi-cards']",
    audioFile: null,
    cue: "This is what your team sees the moment they start a shift.",
    getTitle: () => "Your Plant Overview — the whole operation at a glance.",
    getExplain: () =>
      "Your Plant Overview shows the critical numbers immediately — equipment down, open safety issues, pending maintenance, machine availability, and high-priority items. You can see where attention is needed before your team even starts the shift.",
  },

  // Step 3: Machine Status
  {
    id: 3,
    path: "/dashboard",
    targetSelector: "[data-tour='mfg-machine-status']",
    audioFile: null,
    cue: "Every machine your plant tracks appears here — operational, down, or in maintenance.",
    getTitle: () => "Machine status — all equipment visible immediately.",
    getExplain: () =>
      "The Machine Status board shows every piece of tracked equipment and its current state — operational, needs maintenance, or out of service. When an issue is open against a machine, it shows the count so your team knows which assets are currently affected.",
  },

  // Step 4: Recent Equipment Issues
  {
    id: 4,
    path: "/dashboard",
    targetSelector: "[data-tour='mfg-recent-breakdowns']",
    audioFile: null,
    cue: "Every equipment breakdown lands here the moment it's reported.",
    getTitle: () => "Equipment issues logged the moment they happen.",
    getExplain: () =>
      "Equipment breakdowns get reported immediately — through the app, a QR code on the machine, or your team directly. Every issue is time-stamped and linked to the specific asset, so nothing disappears into a text or verbal handoff.",
  },

  // Step 5: Report an Issue (form-fill)
  {
    id: 5,
    path: "/issues/new",
    targetSelector: "[data-tour='issue-form']",
    audioFile: null,
    type: "form-fill",
    cue: "This is how any team member reports a problem — from a machine breakdown to a safety concern.",
    getTitle: () => "Any operator can report a problem in seconds.",
    getExplain: () =>
      "Whether it's a machine making an unusual noise, a safety hazard, or a quality defect, any team member can log it immediately from their phone or a shared device. The issue is categorized, prioritized, and routed to the right team without any phone calls.",
    getFormData: () => ({
      title: "CNC Machine #3 — spindle vibration at high RPM",
      description: "Spindle vibrating noticeably above 8,000 RPM. Surface finish on current job is borderline. Reducing to 6,000 RPM for now. Needs inspection before next precision run.",
      category: "EQUIPMENT_BREAKDOWN",
    }),
  },

  // Step 6: Issue list / assignment
  {
    id: 6,
    path: "/issues",
    targetSelector: "[data-tour='issue-list']",
    audioFile: null,
    cue: "Every issue is now tracked — no more verbal handoffs or lost texts.",
    getTitle: () => "Every issue tracked, assigned, and resolved.",
    getExplain: () =>
      "Once reported, issues can be assigned to the right maintenance tech or team, set to in-progress, and resolved with full resolution details. Every step is logged so nothing gets dropped and you can see the full history of every problem.",
  },

  // Step 7: QR code on machine
  {
    id: 7,
    path: "/qr-codes",
    targetSelector: "[data-tour='qr-code-list']",
    audioFile: null,
    cue: "Each machine can have its own QR code so operators report problems without leaving the floor.",
    getTitle: () => "QR codes on machines — operators report without leaving the line.",
    getExplain: () =>
      "Attach a QR code to each machine. Operators scan it and tap what's wrong — machine not running, strange noise, quality issue, safety hazard. The report goes directly into Relay linked to that specific asset, with no app login required.",
  },

  // Step 8: Asset / machine detail
  {
    id: 8,
    path: "/assets",
    targetSelector: "[data-tour='asset-list']",
    audioFile: null,
    cue: "Every machine builds its own maintenance history.",
    getTitle: () => "Every machine keeps its own record.",
    getExplain: () =>
      "Each CNC machine, press, robot, conveyor, and utility system builds a history of every breakdown, maintenance visit, and resolution. When something goes wrong, the full history is there — so your team spends less time diagnosing and more time fixing.",
  },

  // Step 9: Locations / plants
  {
    id: 9,
    path: "/locations",
    targetSelector: "[data-tour='location-list']",
    audioFile: null,
    cue: "Each plant is its own location, with its own lines, areas, and equipment.",
    getTitle: () => "All your plants in one system.",
    getExplain: () =>
      "Relay organizes your operation into plants, areas, and lines so every issue, machine, and QR code is tied to the right location. Managers can see which plant has the most open issues and where to focus maintenance resources.",
  },

  // Step 10: Analytics / reports
  {
    id: 10,
    path: "/analytics",
    targetSelector: "[data-tour='analytics-header']",
    audioFile: null,
    cue: "Every resolved issue builds this over time.",
    getTitle: () => "The data that drives better maintenance decisions.",
    getExplain: () =>
      "Over time, the history in Relay shows which equipment fails most often, which categories of issues take longest to resolve, and where recurring breakdowns concentrate. That gives you better information for maintenance schedules, capital equipment decisions, and supplier evaluation.",
  },

  // Step 11: SOPs / safety
  {
    id: 11,
    path: "/sops",
    targetSelector: "[data-tour='sop-list']",
    audioFile: null,
    cue: "LOTO procedures, inspection checklists, and safety SOPs are all here — linked to the work.",
    getTitle: () => "SOPs attached to the work — not buried in a binder.",
    getExplain: () =>
      "Safety procedures, LOTO checklists, and maintenance SOPs live inside Relay where your team actually works. When an issue is flagged for a possible SOP violation, the relevant procedure is visible right alongside the issue so supervisors can address it immediately.",
  },

  // Step 12: Employee Voice
  {
    id: 12,
    path: "/voice",
    targetSelector: "[data-tour='voice-tiles']",
    audioFile: null,
    cue: "Operators can surface ideas and safety concerns directly — no meeting required.",
    getTitle: () => "The people on the floor see problems first.",
    getExplain: () =>
      "Operators notice inefficiencies, near-misses, and process gaps long before they become incidents. Relay gives every team member a direct channel: submit a suggestion, flag a concern, or complete a quick survey. Managers see the patterns that emerge across shifts and departments — the kind of insight that does not show up in maintenance logs.",
  },

  // Step 13: Completion
  {
    id: 13,
    path: null,
    targetSelector: null,
    type: "completion",
    audioFile: null,
    getTitle: () => "That's Relay for Manufacturing.",
    getExplain: () =>
      "Relay helps manufacturing teams replace scattered communication with a shared operational system. Equipment problems are logged the moment they happen. Maintenance staff have clear assignments. Managers have visibility across every plant. That means faster response to breakdowns, fewer dropped issues, and a complete maintenance history for every machine. Start a free trial or schedule a demo to see it in your operation.",
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
