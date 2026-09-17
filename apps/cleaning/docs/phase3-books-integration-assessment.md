# Phase 3 — HCE Books Integration Assessment

*Read-only assessment of `apps/hce-books` in the `/home/w/relay` monorepo. Every structural claim below cites code actually read. No code was changed in this phase.*

## Executive summary

Books is **already multi-tenant at the data-model level** — every ledger table carries `tenantId` **and** `entityId`, and there is a real `Tenant`/`Entity`/`HceUser` hierarchy (`apps/hce-books/prisma/schema.prisma:14-133`). What it **lacks** is Cleaning's *enforced* isolation layer: there is **no `orgDb()` equivalent**. Books talks to the database through the raw, unscoped `prisma` client and relies on every developer remembering to hand-write `where: { tenantId, entityId }` on each query. Some core primitives (`postEntry`, `voidEntry`, `recordInvoicePayment`) fetch by primary key with **no tenant filter at all** (`ledger.ts:95`, `ar.ts:109`, `ar.ts:174`) — exactly the cross-tenant footgun that `org-db.ts` was written to make impossible.

There is **no external/machine-to-machine API**. Auth is a browser JWT session cookie only. No endpoint accepts a POST from another system with a service credential, and there is **no idempotency mechanism** on posted entries. However, a strong *template* for ingest already exists: `apps/hce-books/src/app/api/integrations/payroll/import/route.ts` maps an external CSV to balanced journal entries via the shared ledger service, with a preview/commit flow and keyword account auto-detection.

**Recommendation: Option B is achievable dramatically sooner** and is the right first step. Details in Question 6.

---

## Q1 — Is Books multi-tenant today? Is isolation enforced?

### Data model: yes, two-level tenancy exists

Books has a genuine tenant hierarchy, not a bolted-on `userId` column:

- **`Tenant`** — `schema.prisma:14-46` (`@@map("hce_tenants")`). Owns everything.
- **`Entity`** — `schema.prisma:48-87`. A tenant has many legal entities (`tenantId`, `parentEntityId`, `isConsolidationParent`, `baseCurrency`). This is a books-consolidation concept (holding company + subsidiaries), distinct from tenancy.
- **`HceUser`** — `schema.prisma:89-109`, `@@unique([tenantId, email])`, `role UserRole`.
- **`EntityAccess`** — `schema.prisma:122-133`, join table granting a user access to specific entities.

**Every** financial model carries both `tenantId` and `entityId`, e.g. `Account` (`:159-187`), `JournalEntry` (`:235-263`), `Invoice` (`:430-464`), `Bill` (`:538-570`), `Customer` (`:352-373`). Uniqueness is tenant+entity scoped, e.g. `Account @@unique([tenantId, entityId, code])` (`:183`), `Invoice @@unique([tenantId, entityId, invoiceNumber])` (`:459`).

### Isolation enforcement: NO — there is no `org-db.ts` equivalent

A search of `apps/hce-books/src/lib` (all 18 files), the generated Prisma client, and every API route found **no client extension, middleware, or scoping wrapper**. Specifically:

- `apps/hce-books/src/lib/prisma.ts:16-23` exports a **raw** `PrismaClient` behind a lazy proxy. No `$extends`, no query hook — contrast `apps/cleaning/src/lib/org-db.ts:122-132` which wraps every model/operation.
- There is **no `middleware.ts`** in the app.
- Isolation is **manual** at every call site. Examples:
  - `entity-context.ts:19-22`: `prisma.entity.findMany({ where: { tenantId: session.tenantId, id: { in: session.entityIds } } })`
  - `api/journal/route.ts:16-21`: `prisma.journalEntry.findMany({ where: { tenantId: session.tenantId, entityId } })`
  - `lib/ledger.ts:53-63` `findOpenPeriod` passes `tenantId, entityId` by hand.

### The gap is real, not theoretical

`org-db.ts` deliberately **blocks** `findUnique/update/delete` on tenant models (`org-db.ts:64-70, 111-115`) because their `where` cannot carry `organizationId`. Books does exactly what `org-db.ts` forbids:

- `ledger.ts:95` `postEntry`: `prisma.journalEntry.findUniqueOrThrow({ where: { id: entryId } })` — **no tenant check**. It reads `entry.tenantId` from the row *after* fetching.
- `ledger.ts:209` `voidEntry`: same pattern.
- `ar.ts:109` `sendInvoice` and `ar.ts:174` `recordInvoicePayment`: `findUniqueOrThrow({ where: { id } })` with no tenant scoping.

The only thing standing between this and a cross-tenant breach today is that ids are unguessable cuids and, in practice, **Books runs as a single tenant** — the seed hardcodes one tenant `"hce-tenant"` / "HCE Holdings" with two entities (`prisma/seed.ts:135-206`). There is also a **latent multi-tenant auth bug**: `api/auth/login/route.ts:11` looks up the user with `findFirst({ where: { email } })` — tenant-agnostic — even though `HceUser` allows the same email in different tenants (`@@unique([tenantId, email])`).

**Verdict:** Multi-tenant *schema*, single-tenant *deployment*, **no enforced isolation layer**. Books is materially behind Cleaning here — Cleaning made isolation the default; Books makes it a per-query manual obligation that several core functions already violate.

---

## Q2 — API surface and auth model

### Auth model: browser session JWT only. No machine auth.

- Session = signed JWT in the `hce-session` cookie, 7-day expiry, created on login (`lib/session.ts:13-25`, cookie set in `api/auth/login/route.ts:49-55`). Payload is `{ userId, tenantId, role, entityIds }` (`session.ts:6-11`).
- Password auth via bcrypt (`api/auth/login/route.ts:23`).
- Every protected route calls `requireSession()` (`session.ts:27-36`), which **redirects to `/login`** if unauthenticated — a browser flow, not a 401-for-machines flow.
- Authorization: `lib/permissions.ts` — role matrix (`OWNER/ADMIN/ACCOUNTANT/BOOKKEEPER/VIEWER`, `:15-21`) plus `assertAccess(session, entityId, action)` which checks `session.entityIds.includes(entityId)` (`:32-43, 63-69`).
- **No API key, no bearer token, no HMAC, no service account.** The only `apiKey` references are the outbound `ANTHROPIC_API_KEY` for AI features. The QBO/payroll integration stubs mention "OAuth or API-key exchange" as *future* extension points only.

All 58 route files are session-guarded except `api/auth/login` and `api/auth/logout` (both intentionally public).

### Is there any endpoint that accepts an external system POSTing journal/invoice/AR? No.

No endpoint is designed for external ingest with a service credential. The closest existing routes — all requiring an interactive user session — are:

| Path | Method | What it does |
|---|---|---|
| `api/journal/route.ts` | GET / **POST** | POST creates + posts a balanced journal entry via `createAndPostEntry` (`:31-39`). Body: `{ entityId, date, memo, source, lines[] }`. |
| `api/invoices/route.ts` | GET / **POST** | POST creates a DRAFT invoice via `createInvoice` (`:42-53`); auto-numbers `INV-YYYY-####`. |
| `api/invoices/send/route.ts` | POST | Posts DR AR / CR Revenue and marks invoice SENT. |
| `api/invoices/payment/route.ts` | POST | Records payment DR Cash(1010)/CR AR(1100) (`:23-40`). |
| `api/bills/route.ts`, `api/bills/payment/route.ts` | POST | AP side. |
| `api/integrations/payroll/import/route.ts` | POST | **CSV → balanced payroll journal entries** with preview/commit + account auto-detect. The de-facto ingest template. |
| `api/integrations/qbo/import-coa/route.ts` | POST | Stub for importing a chart of accounts from QuickBooks. |
| `api/recurring/[id]/generate/route.ts` | POST | Materializes recurring templates into entries. |

None accept posted financials without a human `hce-session` cookie.

---

## Q3 — Chart of accounts model

### Model: `Account`, scoped **per entity** (not global, not merely per-tenant)

`schema.prisma:159-187`:

```
model Account {
  id            String  @id @default(cuid())
  tenantId      String
  entityId      String
  code          String
  name          String
  type          AccountType      // ASSET|LIABILITY|EQUITY|INCOME|EXPENSE (:189-198)
  subtype       String?
  normalBalance NormalBalance    // DEBIT|CREDIT (:200-206)
  parentId      String?          // self-hierarchy
  isActive      Boolean @default(true)
  @@unique([tenantId, entityId, code])
  @@index([tenantId, entityId])
}
```

So the COA is duplicated **per (tenant, entity)** — each legal entity gets its own copy. The seed builds a standard COA per entity (`prisma/seed.ts:33-71`, applied via `createCoaForEntity` at `:197-198`). Standard codes Cleaning would post against:

- `1010` Checking Account, `1100` Accounts Receivable, `1200` Prepaid Expenses (ASSET)
- `2100` Sales Tax Payable, `2200` Accrued Liabilities, `2300` Deferred Revenue (LIABILITY)
- `4000` Sales Revenue, `4100` Service Revenue (INCOME)
- `5100` Cost of Services (EXPENSE/COGS), `6000` Salaries & Wages (EXPENSE)

`api/invoices/payment/route.ts:24-25` hardcodes `code: "1100"` (AR) and `code: "1010"` (Cash), confirming these codes are the stable integration anchors.

### How transactions reference accounts

- `JournalLine` (`schema.prisma:291-310`) holds `accountId`, `debit Int`, `credit Int` (**integer cents**), optional `classId`/`departmentId`. `JournalLine` itself carries **no `tenantId`/`entityId`** — it is scoped only through its parent `JournalEntry`. Tenant safety therefore depends entirely on the parent entry being correctly scoped.
- `InvoiceLine.accountId` (`:483`) and `BillLine.accountId` (`:587`) reference the revenue/expense account per line.
- The ledger enforces double-entry and balance (`assertBalanced`, `ledger.ts:45-51`), and posting requires an **OPEN `AccountingPeriod`** covering the date or it throws (`ledger.ts:146-157`). Any external poster must satisfy this.

---

## Q4 — What it would take to accept posted financial events from Cleaning

Concrete work items, grounded in the gaps above:

1. **Machine auth (new).** Add a service-credential path — an API key or signed service JWT — since only browser sessions exist today. Introduce a `Books ingest key` per source system (per Cleaning org). Store hashed; verify in a `requireServiceAuth()` guard mirroring `requireSession()`.
2. **A dedicated ingest endpoint (new).** e.g. `POST /api/ingest/events`. It must **not** use `requireSession()` (which redirects to `/login`); it must return JSON 401/403. Model body handling on the payroll importer — validate, map to accounts, call `createAndPostEntry` (`ledger.ts:138`).
3. **Tenant + entity mapping (new).** Cleaning's `organizationId` must map to a Books `(tenantId, entityId)`. Build an explicit `ExternalSourceMap { sourceSystem, sourceOrgId → tenantId, entityId }`. Do **not** trust a tenantId in the payload.
4. **Idempotency (new — does not exist).** `JournalEntry.sourceId` is `String?` with only `@@index([sourceId])` (`schema.prisma:248, 260`), **not unique**. Add `@@unique([tenantId, entityId, source, sourceId])` (or an `externalId` column) so a retried Cleaning webhook cannot double-post.
5. **Account resolution / mapping.** Resolve by stable `code` per entity (as `invoices/payment` does with `1100`/`1010`), or a Cleaning→Books code-mapping config. Prefer explicit code mapping over the payroll importer's fuzzy keyword auto-detect for automated posting.
6. **Open-period guarantee.** `createAndPostEntry` throws if no OPEN `AccountingPeriod` covers the date (`ledger.ts:146-157`). Ingest must auto-create the period or return a clear retryable error.
7. **Validation.** Balanced lines (already `assertBalanced`), integer-cents amounts, valid `JournalSource`, and referenced accounts belonging to the mapped entity.
8. **Harden isolation (strongly recommended prerequisite).** Before exposing any ingest surface across tenants, port an `org-db.ts`-style scoped client to Books, or at minimum fix the unscoped `findUniqueOrThrow` calls in `ledger.ts:95/209` and `ar.ts:109/174`.
9. **Choose posting granularity.** Summarized journal entries (one balanced entry per event) reuse `createAndPostEntry` directly and are far less coupling than posting documents.

---

## Q5 — Financial events Cleaning should emit, with concrete payloads

Design assumption based on the Books model: Cleaning emits **summarized, balanced journal events** to one ingest endpoint. All amounts are **integer cents** (`JournalLine.debit/credit Int`). Every payload carries an `idempotencyKey` (→ `sourceId`) and a `sourceOrgId` (mapped to tenant/entity). Accounts are referenced by **stable COA `code`**.

Common envelope:

```json
{
  "sourceSystem": "cleaning",
  "sourceOrgId": "org_abc123",
  "idempotencyKey": "clean-inv-9f2c",
  "eventType": "invoice_issued",
  "date": "2026-09-16",
  "currency": "USD",
  "memo": "Invoice #1042 — Acme Offices"
}
```

### 1. `invoice_issued` — DR Accounts Receivable / CR Service Revenue (+ CR Sales Tax Payable)
Mirrors `sendInvoice` (`ar.ts:108-159`).
```json
{
  "eventType": "invoice_issued", "date": "2026-09-16", "idempotencyKey": "clean-inv-1042",
  "externalRef": { "invoiceNumber": "1042", "customerName": "Acme Offices" },
  "subtotalCents": 45000, "taxCents": 2700, "totalCents": 47700,
  "lines": [
    { "accountCode": "1100", "debitCents": 47700, "creditCents": 0 },
    { "accountCode": "4100", "debitCents": 0, "creditCents": 45000 },
    { "accountCode": "2100", "debitCents": 0, "creditCents": 2700 }
  ]
}
```

### 2. `payment_received` — DR Checking / CR Accounts Receivable
Mirrors `recordInvoicePayment` (`ar.ts:173-194`; codes `1010`/`1100`).
```json
{
  "eventType": "payment_received", "date": "2026-09-20", "idempotencyKey": "clean-pay-1042-1",
  "externalRef": { "invoiceNumber": "1042", "paymentMethod": "card" }, "amountCents": 47700,
  "lines": [
    { "accountCode": "1010", "debitCents": 47700, "creditCents": 0 },
    { "accountCode": "1100", "debitCents": 0, "creditCents": 47700 }
  ]
}
```

### 3. `labor_cost_accrued` — DR Salaries & Wages / CR Accrued Liabilities
Analogous to the payroll importer (`payroll/import/route.ts:200-214`), summarized per pay run/job batch. `6000`/`2200` (or `5100` Cost of Services for direct job labor).
```json
{
  "eventType": "labor_cost_accrued", "date": "2026-09-15", "idempotencyKey": "clean-labor-2026w37",
  "externalRef": { "periodStart": "2026-09-08", "periodEnd": "2026-09-14", "hours": 320 },
  "lines": [
    { "accountCode": "6000", "debitCents": 512000, "creditCents": 0 },
    { "accountCode": "2200", "debitCents": 0, "creditCents": 512000 }
  ]
}
```

### 4. `revenue_recognized` — DR Deferred Revenue / CR Service Revenue
For prepaid/recurring plans recognized over time. `2300`/`4100`. (If Cleaning recognizes at invoice time, this collapses into event #1.)
```json
{
  "eventType": "revenue_recognized", "date": "2026-09-30", "idempotencyKey": "clean-rev-plan55-sep",
  "externalRef": { "planId": "plan_55", "recognitionMonth": "2026-09" },
  "lines": [
    { "accountCode": "2300", "debitCents": 30000, "creditCents": 0 },
    { "accountCode": "4100", "debitCents": 0, "creditCents": 30000 }
  ]
}
```

**Server-side rules the payloads honor** (all enforced by `createAndPostEntry`): `sum(debitCents) === sum(creditCents)` per event (`ledger.ts:45-51`); a matching OPEN `AccountingPeriod` for `date` (`ledger.ts:146-157`); `source` set to the appropriate `JournalSource` enum (`INVOICE`/`PAYMENT`/`MANUAL`, `schema.prisma:265-280`); `idempotencyKey` → `sourceId`.

---

## Q6 — Recommendation

**Adopt Option B now** (Cleaning reports its **own company revenue/costs** to Books as a product line; cleaning *customers* keep their own accounting and get QuickBooks/Xero CSV exports). Option A (Books becomes the multi-tenant accounting system serving cleaning customers) is a much larger, riskier program the current code is far from supporting.

**Why B is achievable sooner — grounded in the code:**

- **Books is single-tenant in practice and unsafe for untrusted multi-tenancy.** The seed provisions exactly one tenant (`prisma/seed.ts:135-206`), there is **no enforced isolation layer** (raw client everywhere, `prisma.ts:16-23`), and core mutations fetch by id with no tenant filter (`ledger.ts:95, 209`; `ar.ts:109, 174`). Putting cleaning *customers'* books inside Books would first require porting an `org-db.ts`-equivalent, fixing the login `findFirst`-by-email bug (`api/auth/login/route.ts:11`), auditing all 58 routes, and hardening every unscoped fetch — substantial, security-critical work before a single customer is onboarded.
- **Option B needs no multi-tenancy at all.** Cleaning's own financials post into the **existing single tenant/entity** (the seed already models multiple entities under one tenant). No tenant mapping, no per-customer isolation, no auth-model change for the simplest version.
- **The ingest pattern already exists and is proven.** The payroll importer is the exact end-to-end path — external data → validate → balanced entry → `createAndPostEntry` (`payroll/import/route.ts:36-273`). Wrapping the four Q5 events in one small ingest endpoint plus an idempotency unique-index is days of work, not a platform rebuild.
- **Customer-facing accounting is a solved commodity for B's second half.** Cleaning exporting invoices/payments to QuickBooks/Xero CSV requires zero Books changes and keeps customers on tools they trust — versus Option A, where Books would have to reach parity with those products.

**Suggested sequence:** (1) Ship Option B — a service-authed ingest endpoint + idempotency, post Cleaning's own revenue/labor to the existing tenant/entity, and add QuickBooks/Xero CSV export in Cleaning for customers. (2) *Independently*, if serving customers' books ever becomes a goal, first port `org-db.ts`-style enforced isolation into Books and fix the tenant-scoping gaps in `ledger.ts`/`ar.ts`/login — that hardening is the real gate to Option A and can proceed on its own timeline without blocking B.

---

*Files examined:* `apps/hce-books/prisma/schema.prisma`, `prisma/seed.ts`; `src/lib/{prisma,session,db,entity-context,permissions,ledger,ar}.ts`; `src/app/api/{journal,invoices,invoices/payment,auth/login,integrations/payroll/import,banking/statement-scan}/route.ts`; full route inventory under `src/app/api/**/route.ts` (58 files); reference `apps/cleaning/src/lib/org-db.ts`.
