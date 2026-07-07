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

const INDUSTRY_CONTENT: Record<string, {
  issue: string
  dept: string
  title: string
  desc: string
  category: string
  asset: string
  assetRecurring: string
  vendorType: string
  qrLocations: string
  purchaseExample: string
  openingLine: string
}> = {
  Manufacturing: {
    issue: "conveyor belt failure",
    dept: "production",
    title: "Conveyor leaking hydraulic fluid near Line 2",
    desc: "Noticed hydraulic fluid pooling under the main conveyor drive unit. Line has been slowed as a precaution.",
    category: "EQUIPMENT_BREAKDOWN",
    asset: "Main Drive Conveyor",
    assetRecurring: "conveyor or hydraulic press",
    vendorType: "equipment supplier or hydraulic service contractor",
    qrLocations: "Conveyor Room, Hydraulic Station, Dock Bay 3, and each CNC machine",
    purchaseExample: "conveyor belt or hydraulic seal kit",
    openingLine: "A conveyor just went down on Line 2.",
  },
  Warehousing: {
    issue: "dock door failure",
    dept: "shipping and receiving",
    title: "Dock door 7 not closing correctly",
    desc: "Dock door 7 is not closing or sealing correctly. Shipment in bay 3 is delayed. Reported at start of shift.",
    category: "FACILITY",
    asset: "Dock Door 7",
    assetRecurring: "dock door or forklift",
    vendorType: "door repair contractor or forklift service provider",
    qrLocations: "Dock Door 7, Forklift Bay, Cold Storage Entry, and each loading bay",
    purchaseExample: "dock door seal or forklift battery",
    openingLine: "Dock door 7 isn't closing. A shipment is sitting in bay 3.",
  },
  Restaurant: {
    issue: "refrigerator failure",
    dept: "kitchen",
    title: "Walk-in refrigerator not cooling properly",
    desc: "Walk-in refrigerator temperature is above safe limit. Kitchen team notified and has moved perishables.",
    category: "EQUIPMENT_BREAKDOWN",
    asset: "Walk-In Refrigerator",
    assetRecurring: "walk-in cooler or hood system",
    vendorType: "HVAC contractor or commercial kitchen equipment service",
    qrLocations: "Walk-In Cooler Door, Hood System, Grease Trap, and each prep station",
    purchaseExample: "refrigerator thermostat or hood filter replacement",
    openingLine: "The walk-in cooler isn't cooling. Food safety is at risk.",
  },
  Retail: {
    issue: "POS system failure",
    dept: "store operations",
    title: "POS system offline at register 3",
    desc: "POS terminal at register 3 is offline. Customer service queue is building at the checkout lane.",
    category: "EQUIPMENT_BREAKDOWN",
    asset: "POS Terminal 3",
    assetRecurring: "POS terminal or aisle cooler",
    vendorType: "POS service provider or refrigeration contractor",
    qrLocations: "Checkout Lanes, Aisle Coolers, Stock Room, and the Customer Service Desk",
    purchaseExample: "POS receipt paper roll or cooler door gasket",
    openingLine: "POS terminal at register 3 is offline. The checkout line is growing.",
  },
  Hospitality: {
    issue: "guest room heating failure",
    dept: "housekeeping",
    title: "Guest room heating system failure in Room 214",
    desc: "Guest in room 214 reporting heating system not functioning. Housekeeping confirmed unit is not producing heat.",
    category: "MAINTENANCE",
    asset: "Room 214 HVAC Unit",
    assetRecurring: "HVAC unit or elevator",
    vendorType: "HVAC contractor or elevator service company",
    qrLocations: "Guest Rooms, Elevator Lobby, Pool Mechanical Room, and the Laundry Area",
    purchaseExample: "AC filter replacement or elevator inspection kit",
    openingLine: "Guest in room 214 says the heat isn't working. Housekeeping confirmed it.",
  },
  Healthcare: {
    issue: "HVAC failure in patient wing",
    dept: "facilities",
    title: "HVAC unit not functioning in patient wing",
    desc: "HVAC unit in the east patient wing is not functioning. Temperature is rising. Facilities notified.",
    category: "FACILITY",
    asset: "Patient Wing HVAC Unit",
    assetRecurring: "HVAC unit or medical equipment",
    vendorType: "HVAC contractor or biomedical equipment service",
    qrLocations: "Patient Rooms, Mechanical Room, ICU, and the Emergency Department",
    purchaseExample: "HVAC filter or medical cart battery",
    openingLine: "The HVAC unit in the patient wing is down. Temperature is rising.",
  },
  Education: {
    issue: "projector failure",
    dept: "facilities",
    title: "Classroom projector not working in Building B",
    desc: "Projector in room B-204 not powering on. Class is in session and instructor cannot display materials.",
    category: "EQUIPMENT_BREAKDOWN",
    asset: "Projector B-204",
    assetRecurring: "projector or HVAC unit",
    vendorType: "AV equipment service or facilities contractor",
    qrLocations: "Classrooms, Computer Labs, Gymnasium, and the Library",
    purchaseExample: "projector lamp or HDMI cable replacement",
    openingLine: "Projector in room B-204 won't turn on. Class is in session.",
  },
  "Property Management": {
    issue: "roof leak",
    dept: "maintenance",
    title: "Roof leak reported in unit 4B",
    desc: "Tenant in unit 4B reported water coming through the ceiling. Leak appears to be above the bathroom.",
    category: "FACILITY",
    asset: "Unit 4B Roof",
    assetRecurring: "roof or plumbing system",
    vendorType: "roofing contractor or plumber",
    qrLocations: "Building Entrance, Maintenance Room, Laundry, and each unit lobby",
    purchaseExample: "roofing patch kit or pipe repair coupling",
    openingLine: "Tenant in unit 4B has water coming through the ceiling.",
  },
  "Self-Storage": {
    issue: "gate entry failure",
    dept: "facilities",
    title: "Gate entry system not responding",
    desc: "Main gate entry keypad is not responding to tenant codes. Customers are unable to access their units.",
    category: "FACILITY",
    asset: "Main Gate Entry System",
    assetRecurring: "gate entry system or security camera",
    vendorType: "access control contractor or security systems provider",
    qrLocations: "Main Gate, Storage Unit Rows, Office, and the Loading Dock",
    purchaseExample: "gate keypad or security camera replacement",
    openingLine: "The gate keypad isn't responding. Tenants can't access their units.",
  },
}

// Maps full template labels (stored in DB) back to INDUSTRY_CONTENT keys
const FULL_LABEL_TO_KEY: Record<string, string> = {
  "Warehousing & Distribution":       "Warehousing",
  "Restaurants & Food Service":       "Restaurant",
  "Retail (Multi-Location)":          "Retail",
  "Hospitality & Hotels":             "Hospitality",
  "Healthcare Facilities":            "Healthcare",
  "Education & Campus Operations":    "Education",
  "Property & Facility Management":   "Property Management",
}

function ind(industry: string) {
  const key = FULL_LABEL_TO_KEY[industry] ?? industry
  return INDUSTRY_CONTENT[key] ?? INDUSTRY_CONTENT["Manufacturing"]
}

export const TOUR_STEPS: TourStep[] = [
  // ── Step 1: Welcome (cinematic) ────────────────────────────────────────────────
  {
    id: 1,
    path: null,
    targetSelector: null,
    type: "cinematic",
    getTitle: () => "Welcome to Relay",
    getExplain: () =>
      "Over the next few minutes, we will follow a single issue — from the moment it is reported through assignment, resolution, analysis, and long-term operational improvement. You can pause, skip, or exit at any time.",
  },

  // ── Step 2: Dashboard ──────────────────────────────────────────────────────────
  {
    id: 2,
    path: "/dashboard",
    targetSelector: "[data-tour='kpi-cards']",
    cue: "Take a look at what your team sees every morning.",
    getTitle: () => "The operational command center",
    getExplain: () =>
      "Open issues, escalations, recent activity, and operational performance — all visible in one place. Instead of chasing updates, managers have immediate clarity on what needs attention.",
  },

  // ── Step 3: Report the Issue (form-fill) ──────────────────────────────────────
  {
    id: 3,
    path: "/issues/new",
    targetSelector: "[data-tour='issue-form']",
    type: "form-fill",
    getCue: (industry) => `Watch how fast a ${ind(industry).issue} gets reported.`,
    getTitle: () => "Reporting takes seconds from any device",
    getExplain: (industry) =>
      `Any employee — with or without a Relay account — can report a ${ind(industry).issue} in seconds. We will pre-fill an example and submit it for you.`,
    getFormData: (industry) => ({ title: ind(industry).title, description: ind(industry).desc, category: ind(industry).category }),
  },

  // ── Step 4: Automatic Routing ─────────────────────────────────────────────────
  {
    id: 4,
    path: "SUBMITTED_ISSUE",
    targetSelector: "[data-tour='issue-detail']",
    cue: "Notice how the issue was assigned automatically — no manager intervention needed.",
    getTitle: () => "Routed instantly — no manual sorting",
    getExplain: () =>
      "As soon as the issue was submitted, Relay automatically routed it to the appropriate person based on your organization's routing rules. No manager needed to manually sort incoming requests.",
  },

  // ── Step 5: Issue Detail ───────────────────────────────────────────────────────
  {
    id: 5,
    path: "SUBMITTED_ISSUE",
    targetSelector: "[data-tour='issue-detail']",
    cue: "Every action from here will be tracked in this timeline.",
    getTitle: () => "A complete, auditable history",
    getExplain: () =>
      "Every issue has a complete history. You can always see who reported it, who owns it, what changed, and every action taken from start to finish.",
  },

  // ── Step 6: Issue Intelligence ────────────────────────────────────────────────
  {
    id: 6,
    path: "SUBMITTED_ISSUE",
    targetSelector: "[data-tour='ai-panel']",
    cue: "The AI has already analyzed this issue before anyone even opens it.",
    getTitle: () => "AI analyzes the issue before your team does",
    getExplain: () =>
      "Relay's AI suggests likely causes, recommended actions, and possible resolutions — helping your team respond faster while keeping people in control of every decision.",
  },

  // ── Step 7: SOP Intelligence ──────────────────────────────────────────────────
  {
    id: 7,
    path: "SUBMITTED_ISSUE",
    targetSelector: "[data-tour='sop-panel']",
    cue: "Relay flags when a procedure may have been missed.",
    getTitle: () => "Compliance gaps identified automatically",
    getExplain: () =>
      "Relay identifies when an issue may be related to a standard operating procedure. This helps organizations improve processes — instead of simply fixing the same problems repeatedly.",
  },

  // ── Step 8: Asset History ─────────────────────────────────────────────────────
  {
    id: 8,
    path: "FIRST_ASSET",
    targetSelector: "[data-tour='asset-history']",
    getCue: (industry) => `Now see the full maintenance history for the ${ind(industry).asset}.`,
    getTitle: () => "Every asset tells its own story",
    getExplain: (industry) =>
      `Instead of viewing problems in isolation, your team can understand the complete maintenance history of every piece of equipment. When the same ${ind(industry).assetRecurring} keeps generating tickets, Relay makes that pattern impossible to ignore.`,
  },

  // ── Step 9: Analytics ─────────────────────────────────────────────────────────
  {
    id: 9,
    path: "/analytics",
    targetSelector: "[data-tour='analytics-charts']",
    cue: "Every issue your team resolves builds this intelligence over time.",
    getTitle: () => "Operational intelligence from every issue",
    getExplain: () =>
      "Every issue contributes to better operational insight. Relay identifies recurring failures, response times, bottlenecks, and trends that would otherwise remain hidden in spreadsheets or memory.",
  },

  // ── Step 10: Benchmark Intelligence ──────────────────────────────────────────
  {
    id: 10,
    path: "/analytics",
    targetSelector: "[data-tour='benchmarks-panel']",
    type: "auto-click-benchmarks",
    cue: "See how your operation compares to similar businesses.",
    getTitle: () => "How does your operation compare?",
    getExplain: () =>
      "Relay can anonymously compare your operation against similar organizations. This helps identify opportunities for improvement based on real operational data.",
  },

  // ── Step 11: QR Reporting ─────────────────────────────────────────────────────
  {
    id: 11,
    path: "/qr-codes",
    targetSelector: "[data-tour='qr-list']",
    cue: "Anyone can report an issue — no account required.",
    getTitle: () => "Report from anywhere — no app, no account",
    getExplain: (industry) =>
      `Place a Relay QR code anywhere in your facility — ${ind(industry).qrLocations}. Anyone scans it and reports a problem in seconds. Reports are automatically linked to the correct location or asset.`,
  },

  // ── Step 12: Vendor Management ────────────────────────────────────────────────
  {
    id: 12,
    path: "/vendors",
    targetSelector: "[data-tour='vendor-list'] > div:first-child",
    getCue: (industry) => `Your ${ind(industry).vendorType} stays connected to every issue.`,
    getTitle: () => "Vendors organized in one place",
    getExplain: (industry) =>
      `Relay keeps your ${ind(industry).vendorType} connected to the issues and assets they support. Contacts, service history, and communications stay organized so nothing gets lost across inboxes.`,
  },

  // ── Step 13: Purchase Intelligence ───────────────────────────────────────────
  {
    id: 13,
    path: "/purchase-requests",
    targetSelector: "[data-tour='purchase-intelligence']",
    getCue: (industry) => `Watch how a ${ind(industry).purchaseExample} replacement gets approved automatically.`,
    getTitle: () => "Routine approvals run themselves",
    getExplain: (industry) =>
      `When someone needs to replace a broken ${ind(industry).purchaseExample}, Relay identifies the item, verifies the damage, checks your policy, and automatically approves routine replacements — while escalating larger purchases to the right approver.`,
  },

  // ── Step 14: Executive Features ───────────────────────────────────────────────
  {
    id: 14,
    path: "/dashboard",
    targetSelector: "[data-tour='kpi-cards']",
    cue: "Leadership gets a real-time view of the entire operation.",
    getTitle: () => "Executive visibility at every scale",
    getExplain: () =>
      "As organizations grow, Relay grows with them. Executive dashboards provide operational health scores, AI-generated summaries, and organization-wide performance metrics — without requiring anyone to build a report.",
  },

  // ── Step 15: Roles (cycling) ──────────────────────────────────────────────────
  {
    id: 15,
    path: null,
    targetSelector: "[data-tour='role-switcher']",
    type: "cycling-roles",
    cue: "Notice how the interface changes for each role.",
    getTitle: () => "Every role sees exactly what they need",
    getExplain: () =>
      "Employees report issues. Supervisors manage work. Managers monitor performance. Administrators configure the platform. One system, every level of your organization.",
  },

  // ── Step 16: Industry Presets (cycling) ───────────────────────────────────────
  {
    id: 16,
    path: "/dashboard",
    targetSelector: "[data-tour='industry-selector']",
    type: "cycling-industries",
    cue: "Watch how everything adapts to each industry.",
    getTitle: () => "Pre-configured for your industry from day one",
    getExplain: () =>
      "Departments, assets, issue categories, and workflows change automatically to match the way your organization operates. No custom setup required.",
  },

  // ── Step 17: Packages (cycling) ───────────────────────────────────────────────
  {
    id: 17,
    path: null,
    targetSelector: "[data-tour='package-selector']",
    type: "cycling-packages",
    cue: "See exactly what each plan includes.",
    getTitle: () => "Start simple. Unlock more as you grow.",
    getExplain: () =>
      "Choose the package that matches your operational needs today and expand as you grow. Whether you are managing a single location or hundreds of facilities, Relay scales alongside you.",
  },

  // ── Step 18: Completion ───────────────────────────────────────────────────────
  {
    id: 18,
    path: null,
    targetSelector: null,
    type: "completion",
    getTitle: () => "That's Relay — every issue owned, every action tracked.",
    getExplain: () =>
      "Every issue has an owner. Every action is tracked. Every organization becomes smarter over time. Continue exploring the demo, start your free trial, or schedule a personalized demonstration.",
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
  { label: "Manufacturing", emoji: "🏭", desc: "Conveyor systems, CNC machines, hydraulics, and production line operations." },
  { label: "Warehousing",   emoji: "📦", desc: "Dock doors, forklifts, inventory management, and shipping workflows." },
  { label: "Hospitality",   emoji: "🏨", desc: "Guest rooms, HVAC, elevators, housekeeping, and service escalations." },
  { label: "Restaurant",    emoji: "🍽️", desc: "Kitchen equipment, food safety compliance, walk-in coolers, and service areas." },
  { label: "Retail",        emoji: "🛍️", desc: "POS systems, coolers, customer complaints, and store operations." },
]

export const PACKAGE_DEMOS = [
  {
    label: "Essentials",
    color: "bg-gray-600",
    tier: 0,
    features: [
      { text: "Issue tracking & lifecycle",  included: true },
      { text: "Photo uploads",               included: true },
      { text: "Team management",             included: true },
      { text: "Location & department org",   included: true },
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
      { text: "Issue tracking & lifecycle",  included: true },
      { text: "Photo uploads",               included: true },
      { text: "Team management",             included: true },
      { text: "Location & department org",   included: true },
      { text: "AI Issue Intelligence",       included: true },
      { text: "Asset & vendor management",   included: true },
      { text: "QR code reporting",           included: true },
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
  { emoji: "📋", title: "SOP Management",         desc: "Auto-detects compliance gaps in real time" },
  { emoji: "🚨", title: "Injury Reporting",        desc: "Auto-escalation with regulatory logging" },
  { emoji: "🤝", title: "External Collaborators",  desc: "Contractor & vendor portal access" },
  { emoji: "🏢", title: "Shared Facility Support", desc: "Multi-company operations in one space" },
  { emoji: "📊", title: "Executive AI Briefings",  desc: "Weekly automated performance summaries" },
  { emoji: "❤️", title: "Operational Health Scores", desc: "Real-time facility health scoring" },
  { emoji: "🔔", title: "AI Trend Detection",      desc: "Pattern recognition before problems repeat" },
  { emoji: "🔗", title: "API & Webhooks",          desc: "Connect your existing tools" },
]
