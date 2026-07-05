// Client-safe: no server-only imports. Generates standalone HTML for window.print().

function c(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}
function pct(n: number | null, decimals = 1): string {
  if (n == null) return "—"
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

const BASE_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; font-size: 10pt; color: #111; background: white; }
.page { max-width: 800px; margin: 0 auto; padding: 30px 40px; }
h1 { font-size: 18pt; font-weight: 700; color: #1a1a2e; }
h2 { font-size: 13pt; font-weight: 600; color: #1a1a2e; margin-top: 22px; margin-bottom: 6px; border-bottom: 1.5px solid #d1d5db; padding-bottom: 4px; }
h3 { font-size: 10.5pt; font-weight: 600; color: #374151; margin-top: 14px; margin-bottom: 4px; }
p { line-height: 1.55; margin-bottom: 8px; }
.subtitle { color: #6b7280; font-size: 9.5pt; margin-top: 2px; }
.disclaimer { background: #fef9c3; border: 1px solid #fcd34d; border-radius: 4px; padding: 8px 12px; font-size: 8.5pt; color: #92400e; margin: 12px 0; }
.section { margin-top: 18px; }
table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 6px; }
thead th { background: #f3f4f6; text-align: left; padding: 5px 8px; font-weight: 600; border-bottom: 1px solid #d1d5db; }
tbody tr:nth-child(even) { background: #f9fafb; }
td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
td.num { text-align: right; font-family: "Courier New", monospace; }
td.neg { color: #dc2626; }
tr.total td { font-weight: 700; border-top: 1.5px solid #9ca3af; background: #f3f4f6; }
tr.subtotal td { font-weight: 600; background: #f9fafb; }
.kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 8px; }
.kpi-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; }
.kpi-label { font-size: 8pt; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
.kpi-value { font-size: 14pt; font-weight: 700; color: #111827; margin-top: 3px; }
.narrative { background: #f8f9ff; border-left: 3px solid #6366f1; padding: 10px 14px; border-radius: 0 4px 4px 0; margin-top: 8px; line-height: 1.6; font-size: 9.5pt; }
.badge-green { display: inline-block; background: #d1fae5; color: #065f46; font-size: 7.5pt; font-weight: 600; padding: 1px 6px; border-radius: 9px; }
.badge-red { display: inline-block; background: #fee2e2; color: #991b1b; font-size: 7.5pt; font-weight: 600; padding: 1px 6px; border-radius: 9px; }
.badge-amber { display: inline-block; background: #fef3c7; color: #92400e; font-size: 7.5pt; font-weight: 600; padding: 1px 6px; border-radius: 9px; }
.header-bar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.generated-at { font-size: 8pt; color: #9ca3af; text-align: right; }
@media print {
  .page { padding: 15px 20px; }
  h2 { page-break-after: avoid; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; }
}
`

function plTable(lines: {code:string;name:string;amount:number}[], label: string, total: number, negative = false): string {
  if (lines.length === 0) return ""
  const rows = lines.map((l) =>
    `<tr><td>${l.code}</td><td>${l.name}</td><td class="num${l.amount < 0 ? " neg" : ""}">${c(l.amount)}</td></tr>`
  ).join("")
  return `
<h3>${label}</h3>
<table>
  <thead><tr><th>Code</th><th>Account</th><th>Amount</th></tr></thead>
  <tbody>
    ${rows}
    <tr class="total"><td colspan="2">${label} Total</td><td class="num">${c(total)}</td></tr>
  </tbody>
</table>`
}

function bsSection(lines: {code:string;name:string;amount:number}[], label: string, total: number): string {
  if (lines.length === 0) return ""
  const rows = lines.map((l) =>
    `<tr><td>${l.code}</td><td>${l.name}</td><td class="num">${c(l.amount)}</td></tr>`
  ).join("")
  return `
<h3>${label}</h3>
<table>
  <thead><tr><th>Code</th><th>Account</th><th>Balance</th></tr></thead>
  <tbody>
    ${rows}
    <tr class="total"><td colspan="2">Total ${label}</td><td class="num">${c(total)}</td></tr>
  </tbody>
</table>`
}

// ─── MONTHLY ─────────────────────────────────────────────────────────────────

export function generateMonthlyPrintHTML(data: Record<string, unknown>, narrative: string): string {
  const entity = data.entity as { name: string }
  const period = data.period as { label: string; year: number; month: number }
  const pl     = data.pl as { revenue: {code:string;name:string;amount:number}[]; totalRevenue: number; cogs: {code:string;name:string;amount:number}[]; totalCogs: number; grossProfit: number; expenses: {code:string;name:string;amount:number}[]; totalExpenses: number; netIncome: number }
  const ytd    = data.plYTD as typeof pl
  const bs     = data.balanceSheet as { assets: {code:string;name:string;amount:number}[]; totalAssets: number; liabilities: {code:string;name:string;amount:number}[]; totalLiabilities: number; equity: {code:string;name:string;amount:number}[]; totalEquity: number; totalLiabilitiesAndEquity: number }
  const cf     = data.cashFlow as { operatingActivities:{name:string;amount:number}[]; totalOperating:number; totalInvesting:number; totalFinancing:number; netCashChange:number }
  const kpis   = data.kpis as { grossMarginPct: number|null; netMarginPct: number|null; currentRatio: number|null; cashRunwayMonths: number|null; revGrowthPct: number|null }
  const bv     = (data.budgetVariances as {accountCode:string;accountName:string;budgetedCents:number;actualCents:number;varianceCents:number;variancePct:number|null}[]) ?? []
  const anomalies = (data.anomalies as {severity:string;reason:string}[]) ?? []

  const cfRows = cf.operatingActivities.map((l) =>
    `<tr><td>${l.name}</td><td class="num${l.amount < 0 ? " neg" : ""}">${c(l.amount)}</td></tr>`
  ).join("")

  const bvRows = bv.slice(0, 20).map((v) => {
    const cls = v.varianceCents < 0 ? " neg" : ""
    return `<tr><td>${v.accountCode}</td><td>${v.accountName}</td><td class="num">${c(v.budgetedCents)}</td><td class="num">${c(v.actualCents)}</td><td class="num${cls}">${c(v.varianceCents)}</td><td class="num${cls}">${v.variancePct != null ? `${v.variancePct >= 0 ? "+" : ""}${v.variancePct.toFixed(1)}%` : "—"}</td></tr>`
  }).join("")

  const anomalyRows = anomalies.map((a) => {
    const badge = a.severity === "HIGH" ? "badge-red" : a.severity === "MEDIUM" ? "badge-amber" : "badge-green"
    return `<tr><td><span class="${badge}">${a.severity}</span></td><td>${a.reason}</td></tr>`
  }).join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Monthly Financial Report — ${entity.name} — ${period.label}</title>
<style>${BASE_CSS}</style>
</head>
<body>
<div class="page">

  <div class="header-bar">
    <div>
      <h1>Monthly Financial Report</h1>
      <p class="subtitle">${entity.name} · ${period.label}${(data.consolidated as boolean) ? " (Consolidated)" : ""}</p>
    </div>
    <div class="generated-at">Generated ${fmtDate(data.generatedAt as string)}<br>For internal use</div>
  </div>

  ${narrative ? `
  <h2>Executive Summary</h2>
  <div class="narrative">${narrative.replace(/\n/g, "<br>")}</div>` : ""}

  <div class="section">
    <h2>Key Metrics</h2>
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Revenue</div><div class="kpi-value">${c(pl.totalRevenue)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Gross Margin</div><div class="kpi-value">${pct(kpis.grossMarginPct)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Net Income</div><div class="kpi-value">${c(pl.netIncome)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Cash Position</div><div class="kpi-value">${c((data.cashPositionCents as number) ?? 0)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Cash Runway</div><div class="kpi-value">${kpis.cashRunwayMonths != null ? `${kpis.cashRunwayMonths.toFixed(1)} mo` : "—"}</div></div>
      <div class="kpi-card"><div class="kpi-label">Current Ratio</div><div class="kpi-value">${kpis.currentRatio != null ? kpis.currentRatio.toFixed(2) : "—"}</div></div>
    </div>
  </div>

  <div class="section">
    <h2>Income Statement — ${period.label}</h2>
    ${plTable(pl.revenue, "Revenue", pl.totalRevenue)}
    ${plTable(pl.cogs, "Cost of Goods Sold", pl.totalCogs)}
    <table><tbody><tr class="subtotal"><td colspan="2">Gross Profit</td><td class="num">${c(pl.grossProfit)}</td></tr></tbody></table>
    ${plTable(pl.expenses, "Operating Expenses", pl.totalExpenses)}
    <table><tbody><tr class="total"><td colspan="2">Net Income</td><td class="num${pl.netIncome < 0 ? " neg" : ""}">${c(pl.netIncome)}</td></tr></tbody></table>
  </div>

  <div class="section">
    <h2>Income Statement — Year-to-Date</h2>
    <table>
      <thead><tr><th>Line</th><th>YTD Amount</th></tr></thead>
      <tbody>
        <tr><td>Revenue</td><td class="num">${c(ytd.totalRevenue)}</td></tr>
        <tr><td>COGS</td><td class="num">${c(ytd.totalCogs)}</td></tr>
        <tr class="subtotal"><td>Gross Profit</td><td class="num">${c(ytd.grossProfit)}</td></tr>
        <tr><td>Operating Expenses</td><td class="num">${c(ytd.totalExpenses)}</td></tr>
        <tr class="total"><td>Net Income</td><td class="num${ytd.netIncome < 0 ? " neg" : ""}">${c(ytd.netIncome)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Balance Sheet — as of ${period.label} End</h2>
    ${bsSection(bs.assets, "Assets", bs.totalAssets)}
    ${bsSection(bs.liabilities, "Liabilities", bs.totalLiabilities)}
    ${bsSection(bs.equity, "Equity", bs.totalEquity)}
    <table><tbody><tr class="total"><td colspan="2">Total Liabilities + Equity</td><td class="num">${c(bs.totalLiabilitiesAndEquity)}</td></tr></tbody></table>
  </div>

  <div class="section">
    <h2>Cash Flow Statement</h2>
    <table>
      <thead><tr><th>Activity</th><th>Amount</th></tr></thead>
      <tbody>
        ${cfRows}
        <tr class="total"><td>Net Cash from Operations</td><td class="num${cf.totalOperating < 0 ? " neg" : ""}">${c(cf.totalOperating)}</td></tr>
        <tr><td>Investing Activities</td><td class="num">${c(cf.totalInvesting)}</td></tr>
        <tr><td>Financing Activities</td><td class="num">${c(cf.totalFinancing)}</td></tr>
        <tr class="total"><td>Net Change in Cash</td><td class="num${cf.netCashChange < 0 ? " neg" : ""}">${c(cf.netCashChange)}</td></tr>
      </tbody>
    </table>
  </div>

  ${bv.length > 0 ? `
  <div class="section">
    <h2>Budget vs Actual</h2>
    <table>
      <thead><tr><th>Code</th><th>Account</th><th>Budget</th><th>Actual</th><th>Variance $</th><th>Variance %</th></tr></thead>
      <tbody>${bvRows}</tbody>
    </table>
  </div>` : ""}

  ${anomalies.length > 0 ? `
  <div class="section">
    <h2>Anomalies &amp; Flags</h2>
    <table>
      <thead><tr><th>Severity</th><th>Description</th></tr></thead>
      <tbody>${anomalyRows}</tbody>
    </table>
  </div>` : ""}

</div>
<script>window.addEventListener("load", () => { window.print(); window.addEventListener("afterprint", () => window.close()); });</script>
</body>
</html>`
}

// ─── TAX ─────────────────────────────────────────────────────────────────────

export function generateTaxPrintHTML(data: Record<string, unknown>, narrative: string): string {
  const entity = data.entity as { name: string }
  const fy     = data.fiscalYear as number
  const pl     = data.pl as { revenue:{code:string;name:string;amount:number}[];totalRevenue:number;cogs:{code:string;name:string;amount:number}[];totalCogs:number;grossProfit:number;expenses:{code:string;name:string;amount:number}[];totalExpenses:number;netIncome:number }
  const bs     = data.balanceSheet as { assets:{code:string;name:string;amount:number}[];totalAssets:number;liabilities:{code:string;name:string;amount:number}[];totalLiabilities:number;equity:{code:string;name:string;amount:number}[];totalEquity:number;totalLiabilitiesAndEquity:number }
  const tb     = (data.trialBalance as {code:string;name:string;type:string;debit:number;credit:number;balance:number}[]) ?? []
  const fas    = (data.fixedAssets as {name:string;category:string;acquisitionDate:string;costCents:number;depreciationMethod:string;usefulLifeMonths:number;depreciationYearCents:number}[]) ?? []
  const vp     = (data.vendorPayments as {vendorName:string;totalPaidCents:number;note1099:string}[]) ?? []

  const tbRows = tb.map((r) =>
    `<tr><td>${r.code}</td><td>${r.name}</td><td>${r.type}</td><td class="num">${c(r.debit)}</td><td class="num">${c(r.credit)}</td><td class="num${r.balance < 0 ? " neg" : ""}">${c(r.balance)}</td></tr>`
  ).join("")

  const faRows = fas.map((f) =>
    `<tr><td>${f.name}</td><td>${f.category}</td><td>${f.acquisitionDate}</td><td class="num">${c(f.costCents)}</td><td>${f.depreciationMethod}</td><td>${f.usefulLifeMonths}mo</td><td class="num">${c(f.depreciationYearCents)}</td></tr>`
  ).join("")

  const vpRows = vp.map((v) =>
    `<tr><td>${v.vendorName}</td><td class="num">${c(v.totalPaidCents)}</td><td>${v.note1099 ? `<span class="badge-amber">${v.note1099}</span>` : ""}</td></tr>`
  ).join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Tax Packet FY${fy} — ${entity.name}</title>
<style>${BASE_CSS}</style>
</head>
<body>
<div class="page">

  <div class="header-bar">
    <div>
      <h1>CPA Tax Preparation Packet</h1>
      <p class="subtitle">${entity.name} · Fiscal Year ${fy}${(data.consolidated as boolean) ? " (Consolidated)" : ""}</p>
    </div>
    <div class="generated-at">Generated ${fmtDate(data.generatedAt as string)}</div>
  </div>

  <div class="disclaimer">⚠ ${data.disclaimer as string}</div>

  ${narrative ? `
  <h2>Summary Memo</h2>
  <div class="narrative">${narrative.replace(/\n/g, "<br>")}</div>` : ""}

  <div class="section">
    <h2>Income Statement — FY${fy}</h2>
    ${plTable(pl.revenue, "Revenue", pl.totalRevenue)}
    ${plTable(pl.cogs, "Cost of Goods Sold", pl.totalCogs)}
    <table><tbody><tr class="subtotal"><td colspan="2">Gross Profit</td><td class="num">${c(pl.grossProfit)}</td></tr></tbody></table>
    ${plTable(pl.expenses, "Operating Expenses", pl.totalExpenses)}
    <table><tbody><tr class="total"><td colspan="2">Net Income</td><td class="num${pl.netIncome < 0 ? " neg" : ""}">${c(pl.netIncome)}</td></tr></tbody></table>
  </div>

  <div class="section">
    <h2>Balance Sheet — as of 12/31/${fy}</h2>
    ${bsSection(bs.assets, "Assets", bs.totalAssets)}
    ${bsSection(bs.liabilities, "Liabilities", bs.totalLiabilities)}
    ${bsSection(bs.equity, "Equity", bs.totalEquity)}
  </div>

  <div class="section">
    <h2>Trial Balance — FY${fy}</h2>
    <table>
      <thead><tr><th>Code</th><th>Account</th><th>Type</th><th>Debits</th><th>Credits</th><th>Balance</th></tr></thead>
      <tbody>${tbRows}</tbody>
    </table>
  </div>

  <div class="section">
    <h2>Fixed Asset Register &amp; Depreciation Schedule</h2>
    ${fas.length === 0 ? "<p>No fixed assets on record.</p>" : `
    <table>
      <thead><tr><th>Asset</th><th>Category</th><th>In Service</th><th>Cost</th><th>Method</th><th>Life</th><th>Depr FY${fy}</th></tr></thead>
      <tbody>${faRows}</tbody>
    </table>
    <p style="font-size:8.5pt;color:#6b7280;margin-top:6px">Section 179 / bonus depreciation elections to be determined by tax professional.</p>`}
  </div>

  <div class="section">
    <h2>Vendor Payments &amp; 1099 Summary</h2>
    ${vp.length === 0 ? "<p>No vendor payments on record.</p>" : `
    <table>
      <thead><tr><th>Vendor</th><th>Total Paid FY${fy}</th><th>1099 Note</th></tr></thead>
      <tbody>${vpRows}</tbody>
    </table>
    <p style="font-size:8.5pt;color:#6b7280;margin-top:6px">1099-NEC required for non-corporate vendors paid ≥$600 for services. Verify W-9 / tax classification with each vendor.</p>`}
  </div>

</div>
<script>window.addEventListener("load", () => { window.print(); window.addEventListener("afterprint", () => window.close()); });</script>
</body>
</html>`
}

// ─── INVESTOR ────────────────────────────────────────────────────────────────

export function generateInvestorPrintHTML(data: Record<string, unknown>, narrative: string): string {
  const entity = data.entity as { name: string }
  const hist   = (data.historicalPL as {year:number;isPartialYear:boolean;pl:{totalRevenue:number;totalCogs:number;grossProfit:number;totalExpenses:number;netIncome:number}}[]) ?? []
  const ttm    = data.plTTM as typeof hist[0]["pl"]
  const bs     = data.balanceSheet as {assets:{code:string;name:string;amount:number}[];totalAssets:number;liabilities:{code:string;name:string;amount:number}[];totalLiabilities:number;equity:{code:string;name:string;amount:number}[];totalEquity:number;totalLiabilitiesAndEquity:number}
  const cf     = data.cashFlow as {operatingActivities:{name:string;amount:number}[];totalOperating:number;netCashChange:number}

  const histRows = hist.map((h) =>
    `<tr><td>${h.year}${h.isPartialYear ? "*" : ""}</td><td class="num">${c(h.pl.totalRevenue)}</td><td class="num">${c(h.pl.grossProfit)}</td><td class="num${h.pl.netIncome < 0 ? " neg" : ""}">${c(h.pl.netIncome)}</td><td class="num${h.pl.netIncome < 0 ? " neg" : ""}">${h.pl.totalRevenue > 0 ? pct((h.pl.netIncome / h.pl.totalRevenue) * 100, 1) : "—"}</td></tr>`
  ).join("")

  const bsRows = [...bs.assets.slice(0, 10), { code: "TOTAL ASSETS", name: "Total Assets", amount: bs.totalAssets }].map((a) =>
    `<tr${a.code === "TOTAL ASSETS" ? ' class="total"' : ""}><td>${a.code}</td><td>${a.name}</td><td class="num">${c(a.amount)}</td></tr>`
  ).join("")

  const cfRows = cf.operatingActivities.map((l) =>
    `<tr><td>${l.name}</td><td class="num${l.amount < 0 ? " neg" : ""}">${c(l.amount)}</td></tr>`
  ).join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Investor Presentation — ${entity.name}</title>
<style>${BASE_CSS}</style>
</head>
<body>
<div class="page">

  <div class="header-bar">
    <div>
      <h1>Investor &amp; Lender Presentation</h1>
      <p class="subtitle">${entity.name}${(data.consolidated as boolean) ? " (Consolidated)" : ""} · Generated ${fmtDate(data.generatedAt as string)}</p>
    </div>
    <div class="generated-at">Confidential</div>
  </div>

  <div class="disclaimer">${data.disclaimer as string}</div>

  ${narrative ? `
  <h2>Executive Overview</h2>
  <div class="narrative">${narrative.replace(/\n/g, "<br>")}</div>` : ""}

  <div class="section">
    <h2>Financial Highlights</h2>
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">TTM Revenue</div><div class="kpi-value">${c(ttm.totalRevenue)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Gross Margin</div><div class="kpi-value">${data.grossMarginPct != null ? pct(data.grossMarginPct as number) : "—"}</div></div>
      <div class="kpi-card"><div class="kpi-label">Net Margin</div><div class="kpi-value">${data.netMarginPct != null ? pct(data.netMarginPct as number) : "—"}</div></div>
      <div class="kpi-card"><div class="kpi-label">Revenue Growth</div><div class="kpi-value">${data.revenueGrowthPct != null ? pct(data.revenueGrowthPct as number) : "—"}</div></div>
      <div class="kpi-card"><div class="kpi-label">Cash</div><div class="kpi-value">${c((data.cashPositionCents as number) ?? 0)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Runway</div><div class="kpi-value">${data.runwayMonths != null ? `${(data.runwayMonths as number).toFixed(1)} mo` : "—"}</div></div>
    </div>
  </div>

  <div class="section">
    <h2>Historical Performance</h2>
    <table>
      <thead><tr><th>Year</th><th>Revenue</th><th>Gross Profit</th><th>Net Income</th><th>Net Margin</th></tr></thead>
      <tbody>
        ${histRows}
        <tr class="total"><td>TTM</td><td class="num">${c(ttm.totalRevenue)}</td><td class="num">${c(ttm.grossProfit)}</td><td class="num${ttm.netIncome < 0 ? " neg" : ""}">${c(ttm.netIncome)}</td><td class="num">${ttm.totalRevenue > 0 ? pct((ttm.netIncome / ttm.totalRevenue) * 100) : "—"}</td></tr>
      </tbody>
    </table>
    <p style="font-size:8pt;color:#9ca3af;margin-top:4px">* Partial year (through current date)</p>
  </div>

  <div class="section">
    <h2>Balance Sheet (Current)</h2>
    ${bsSection(bs.assets, "Assets", bs.totalAssets)}
    ${bsSection(bs.liabilities, "Liabilities", bs.totalLiabilities)}
    ${bsSection(bs.equity, "Equity", bs.totalEquity)}
  </div>

  <div class="section">
    <h2>Cash Flow (TTM)</h2>
    <table>
      <thead><tr><th>Activity</th><th>Amount</th></tr></thead>
      <tbody>
        ${cfRows}
        <tr class="total"><td>Net Cash from Operations</td><td class="num${cf.totalOperating < 0 ? " neg" : ""}">${c(cf.totalOperating)}</td></tr>
        <tr><td>Monthly Burn (3-mo avg)</td><td class="num">${c((data.monthlyBurnCents as number) ?? 0)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Indicative Valuation</h2>
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Low</div><div class="kpi-value">${c((data.valuationLow as number) ?? 0)}</div></div>
      <div class="kpi-card"><div class="kpi-label" style="color:#1d4ed8">Base</div><div class="kpi-value" style="color:#1d4ed8">${c((data.valuationBase as number) ?? 0)}</div></div>
      <div class="kpi-card"><div class="kpi-label">High</div><div class="kpi-value">${c((data.valuationHigh as number) ?? 0)}</div></div>
    </div>
    <p style="font-size:8.5pt;color:#6b7280;margin-top:8px">${data.valuationNote as string} This is an indicative revenue-multiple range for discussion only — not a formal appraisal.</p>
  </div>

</div>
<script>window.addEventListener("load", () => { window.print(); window.addEventListener("afterprint", () => window.close()); });</script>
</body>
</html>`
}
