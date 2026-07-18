import type { Step } from "react-joyride"

// Each step may carry extra metadata for the tour engine
export type TourStep = Step & {
  data?: {
    navigate?: string   // Route to navigate to before showing this step
    chapter?: number    // Chapter number for progress display
    chapterTitle?: string
  }
}

export const TOUR_CHAPTERS = [
  { number: 1, title: "Welcome" },
  { number: 2, title: "Chart of Accounts" },
  { number: 3, title: "Invoices & Sales" },
  { number: 4, title: "Bills & Expenses" },
  { number: 5, title: "Banking" },
  { number: 6, title: "Reports" },
  { number: 7, title: "Intercompany" },
  { number: 8, title: "AI Features" },
  { number: 9, title: "You're Ready" },
]

export const TOUR_STEPS: TourStep[] = [
  // ═══════════════════════════════════════════════════════
  // CHAPTER 1 — Welcome & Orientation
  // ═══════════════════════════════════════════════════════
  {
    target: "body",
    placement: "center",
    title: "👋 Welcome to HCE Books",
    content: "This is your accounting home base for HCE Holdings and Relay. This quick tour will show you where everything lives and what it all means — no accounting degree required. Takes about 3 minutes.",
    data: { chapter: 1, chapterTitle: "Welcome", navigate: "/dashboard" },
  },
  {
    target: "[data-tour='entity-switcher']",
    placement: "right",
    title: "Your Entities — HCE & Relay",
    content: "HCE and Relay each have their own separate set of books. Click here to switch between them, or view a consolidated picture of the whole group at once. Think of it like switching between different company checkbooks.",
    data: { chapter: 1 },
  },
  {
    target: "[data-tour='sidebar-nav']",
    placement: "right",
    title: "Everything Lives Here",
    content: "The sidebar is your map. Sales on top, expenses below, then banking, reports, and planning tools. We'll walk through each section together.",
    data: { chapter: 1 },
  },

  // ═══════════════════════════════════════════════════════
  // CHAPTER 2 — Chart of Accounts
  // ═══════════════════════════════════════════════════════
  {
    target: "[data-tour='nav-accounts']",
    placement: "right",
    title: "📋 Chart of Accounts",
    content: "The Chart of Accounts is like a filing system for money. Every dollar that comes in or goes out gets filed under one of your accounts — Assets (things you own), Liabilities (things you owe), Income, and Expenses. It's the backbone of your books.",
    data: { chapter: 2, chapterTitle: "Chart of Accounts", navigate: "/accounts" },
  },
  {
    target: "main h1",
    placement: "bottom",
    title: "Your Account Categories",
    content: "These are the buckets your transactions fall into. QuickBooks or Xero users: your existing chart of accounts can be imported via Settings → Integrations. For a new setup, we've pre-loaded a starter set.",
    data: { chapter: 2, navigate: "/accounts" },
  },

  // ═══════════════════════════════════════════════════════
  // CHAPTER 3 — Customers & Invoices
  // ═══════════════════════════════════════════════════════
  {
    target: "[data-tour='nav-invoices']",
    placement: "right",
    title: "💰 Invoices — Money Owed To You",
    content: "An invoice is a bill you send to a customer. It says 'you owe us $X for this work.' When you create and send an invoice here, it shows up as Accounts Receivable — money you're owed but haven't collected yet.",
    data: { chapter: 3, chapterTitle: "Invoices & Sales", navigate: "/invoices" },
  },
  {
    target: "main h1",
    placement: "bottom",
    title: "Your Invoices List",
    content: "All your outstanding and paid invoices live here. Statuses: Draft (not sent yet), Sent (waiting on payment), Partial (some paid), and Paid. When a payment comes in, you record it here and the books update automatically.",
    data: { chapter: 3, navigate: "/invoices" },
  },
  {
    target: "[data-tour='nav-customers']",
    placement: "right",
    title: "👥 Customers",
    content: "Your customer list stores billing addresses, contacts, and payment history. You'll select from this list when creating invoices — no retyping the same info every time.",
    data: { chapter: 3 },
  },

  // ═══════════════════════════════════════════════════════
  // CHAPTER 4 — Vendors & Bills
  // ═══════════════════════════════════════════════════════
  {
    target: "[data-tour='nav-bills']",
    placement: "right",
    title: "🧾 Bills — Money You Owe",
    content: "A bill is an invoice you received from a vendor — rent, software subscriptions, contractor invoices. Entering bills here means your expenses hit the books on the right date, not just when you pay cash.",
    data: { chapter: 4, chapterTitle: "Bills & Expenses", navigate: "/bills" },
  },
  {
    target: "main h1",
    placement: "bottom",
    title: "Your Bills Queue",
    content: "Unpaid bills show here as Accounts Payable — money you owe but haven't paid. As you pay them, mark them paid and the cash account updates. This keeps your cash flow picture accurate.",
    data: { chapter: 4, navigate: "/bills" },
  },
  {
    target: "[data-tour='nav-vendors']",
    placement: "right",
    title: "🏢 Vendors",
    content: "Vendors are the businesses you pay. Storing them here means vendor invoices (bills) auto-populate with their info, and you get a full payment history per vendor — handy for 1099 prep at year-end.",
    data: { chapter: 4 },
  },

  // ═══════════════════════════════════════════════════════
  // CHAPTER 5 — Banking & Reconciliation
  // ═══════════════════════════════════════════════════════
  {
    target: "[data-tour='nav-banking']",
    placement: "right",
    title: "🏦 Banking — Your Real-World Accounts",
    content: "Connect your bank accounts here. Once connected, transactions flow in automatically via Plaid so you're not typing them manually. Each transaction gets matched to an account in your books.",
    data: { chapter: 5, chapterTitle: "Banking", navigate: "/banking" },
  },
  {
    target: "main h1",
    placement: "bottom",
    title: "Bank Accounts & Transactions",
    content: "Your linked bank accounts and their imported transactions live here. Click a transaction to categorize it — assign it to the right account and it posts to your books.",
    data: { chapter: 5, navigate: "/banking" },
  },
  {
    target: "[data-tour='nav-reconcile']",
    placement: "right",
    title: "✅ Reconciliation — Making the Numbers Match",
    content: "Reconciling means comparing what your books say against what the bank statement says. It's the accounting version of balancing your checkbook. Do it monthly to catch errors early. The reconcile screen walks you through it step by step.",
    data: { chapter: 5 },
  },

  // ═══════════════════════════════════════════════════════
  // CHAPTER 6 — Reports
  // ═══════════════════════════════════════════════════════
  {
    target: "[data-tour='nav-reports']",
    placement: "right",
    title: "📊 Reports — Your Financial Story",
    content: "Three core reports tell the whole story of your business finances. Let's see what they are.",
    data: { chapter: 6, chapterTitle: "Reports", navigate: "/reports" },
  },
  {
    target: "main h1",
    placement: "bottom",
    title: "P&L, Balance Sheet, Cash Flow",
    content: "P&L (Profit & Loss): Did we make money this month? It shows revenue minus expenses = net profit. Balance Sheet: What do we own vs. what do we owe? A snapshot of financial health at one moment. Cash Flow: When did cash actually come in and go out? Profit and cash timing are different — this shows cash reality.",
    data: { chapter: 6, navigate: "/reports" },
  },

  // ═══════════════════════════════════════════════════════
  // CHAPTER 7 — Intercompany
  // ═══════════════════════════════════════════════════════
  {
    target: "[data-tour='nav-intercompany']",
    placement: "right",
    title: "🔄 Intercompany Transactions",
    content: "When HCE pays Relay for something (or vice versa), it shows up in both sets of books. The Intercompany screen tracks these transactions so that when you view consolidated financials, the internal transfers cancel out — leaving only the group's real external activity.",
    data: { chapter: 7, chapterTitle: "Intercompany", navigate: "/intercompany" },
  },

  // ═══════════════════════════════════════════════════════
  // CHAPTER 8 — AI Features
  // ═══════════════════════════════════════════════════════
  {
    target: "[data-tour='nav-dashboard']",
    placement: "right",
    title: "🤖 AI Controller Dashboard",
    content: "The Controller Dashboard gives you a CFO-style overview: key metrics, budget alerts, anomalies, and a Daily Briefing you can generate anytime — AI reads your actual numbers and summarizes what's happening.",
    data: { chapter: 8, chapterTitle: "AI Features", navigate: "/dashboard" },
  },
  {
    target: "[data-tour='nav-ask']",
    placement: "right",
    title: "💬 Ask Anything in Plain English",
    content: 'Type any question about your finances: "What did we spend on software last quarter?" or "Can we afford a $60K hire?" The AI reads your real books and answers with your actual numbers — no spreadsheet needed.',
    data: { chapter: 8 },
  },
  {
    target: "[data-tour='nav-cashflow']",
    placement: "right",
    title: "💧 Cash Flow & Runway",
    content: "The Cash Flow screen forecasts your cash position weeks out, shows your burn rate, and tells you how many months of runway you have at the current spending rate. Critical for planning.",
    data: { chapter: 8 },
  },
  {
    target: "[data-tour='nav-scenarios']",
    placement: "right",
    title: "🧪 Scenario Modeling",
    content: "Before making a big decision — hiring, buying equipment, taking on debt — run a scenario. See the before-vs-after impact on your cash and burn rate, with the math shown.",
    data: { chapter: 8 },
  },
  {
    target: "[data-tour='nav-valuation']",
    placement: "right",
    title: "⚖️ Business Valuation",
    content: "Get an indicative value range for planning — built from your real EBITDA and revenue. Not a certified appraisal, but useful for conversations with investors, lenders, or when thinking about the future.",
    data: { chapter: 8 },
  },

  // ═══════════════════════════════════════════════════════
  // CHAPTER 9 — Wrap-up
  // ═══════════════════════════════════════════════════════
  {
    target: "body",
    placement: "center",
    title: "🎉 You're Ready!",
    content: "Great job! Here's where to start:\n\n1. Set up your Chart of Accounts (or import from QBO/Xero)\n2. Add your first customer and send an invoice\n3. Enter any outstanding vendor bills\n4. Connect a bank account in Banking\n\nYou can relaunch this tour anytime from the Help button in the sidebar.",
    data: { chapter: 9, chapterTitle: "You're Ready!" },
  },
]
