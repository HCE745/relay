// Phase 16 SECURITY verification — the highest-risk code in the product. Proves
// a portal (CLIENT) user: can only ever see THEIR OWN customer's data; cannot
// read another customer's jobs/invoices/issues/inspections/photos; never sees
// pay rates, labor cost, margins, or other employees; can report issues only
// against their own sites; and that the invite→accept→login flow is sound and
// staff accounts can't log in to the portal.
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase16-portal-security.ts

import { systemDb } from "../src/lib/org-db"
import { createPortalInvite, acceptPortalInvite, portalLogin, getPortalDashboard, reportPortalIssue, getPortalPhoto, getPortalInvoiceById, getPortalJobById, getPortalInspectionById } from "../src/lib/data/portal"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}
async function threw(fn: () => Promise<unknown>) { try { await fn(); return null } catch (e) { return (e as Error).message } }

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Portal Sec", slug: `ps-${stamp}`, packageTier: "TEAM", timezone: "UTC" } })
  const mgr = await systemDb.user.create({ data: { organizationId: org.id, name: "Mgr", email: `mgr-${stamp}@t.co`, password: "x", role: "MANAGER" } })
  const cleaner = await systemDb.user.create({ data: { organizationId: org.id, name: "Secret Cleaner", email: `cl-${stamp}@t.co`, password: "x", role: "CLEANER", employeeProfile: { create: { organizationId: org.id, payType: "HOURLY", payRate: "99.99" } } } })

  // Two customers in the same org.
  const custA = await systemDb.customer.create({ data: { organizationId: org.id, name: "Customer A" } })
  const custB = await systemDb.customer.create({ data: { organizationId: org.id, name: "Customer B SECRET" } })
  const siteA = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: custA.id, name: "A HQ", timezone: "UTC" } })
  const siteB = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: custB.id, name: "B HQ", timezone: "UTC" } })

  const mkJob = (siteId: string, title: string, status: string) =>
    systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: siteId, title, status: status as "COMPLETED", scheduledStart: new Date("2026-06-10T09:00:00Z"), actualEnd: new Date("2026-06-10T11:00:00Z") } })
  const jobA = await mkJob(siteA.id, "A nightly", "COMPLETED")
  const jobB = await mkJob(siteB.id, "B SECRET job", "COMPLETED")
  await mkJob(siteA.id, "A upcoming", "SCHEDULED").then((j) => systemDb.job.update({ where: { id: j.id }, data: { scheduledStart: new Date(Date.now() + 86_400_000) } }))
  // Assign the well-paid cleaner to A's job — portal must never reveal them.
  await systemDb.jobAssignment.create({ data: { organizationId: org.id, jobId: jobA.id, userId: cleaner.id } })
  const photoA = await systemDb.jobPhoto.create({ data: { organizationId: org.id, jobId: jobA.id, storageKey: "k/a.jpg", contentType: "image/jpeg", sizeBytes: 10, uploadedById: cleaner.id } })
  const photoB = await systemDb.jobPhoto.create({ data: { organizationId: org.id, jobId: jobB.id, storageKey: "k/b.jpg", contentType: "image/jpeg", sizeBytes: 10, uploadedById: cleaner.id } })
  await systemDb.inspection.create({ data: { organizationId: org.id, serviceLocationId: siteA.id, inspectorId: cleaner.id, templateName: "QC", passThreshold: 80, status: "FINALIZED", score: 92, outcome: "PASS", finalizedAt: new Date() } })
  const inspB = await systemDb.inspection.create({ data: { organizationId: org.id, serviceLocationId: siteB.id, inspectorId: cleaner.id, templateName: "QC", passThreshold: 80, status: "FINALIZED", score: 41, outcome: "FAIL", finalizedAt: new Date() } })
  await systemDb.issue.create({ data: { organizationId: org.id, serviceLocationId: siteB.id, reportedById: mgr.id, description: "B SECRET issue", status: "OPEN" } })
  const mkInvoice = (customerId: string, num: number) =>
    systemDb.invoice.create({ data: { organizationId: org.id, customerId, invoiceNumber: num, status: "SENT", issueDate: new Date(), dueDate: new Date(), periodStart: new Date(), periodEnd: new Date(), subtotal: "100", total: "100" } })
  await mkInvoice(custA.id, 1)
  const invB = await mkInvoice(custB.id, 2)

  console.log("Invite → accept → login binds the user to exactly one customer:")
  const invite = await createPortalInvite(org.id, custA.id, `client-${stamp}@acme.co`, mgr.id, "https://app.test")
  const pre = await systemDb.user.findFirstOrThrow({ where: { email: `client-${stamp}@acme.co` } })
  check("invite creates an INACTIVE CLIENT bound to customer A", pre.role === "CLIENT" && pre.isActive === false && pre.customerId === custA.id)
  check("login is refused before activation", (await portalLogin(`client-${stamp}@acme.co`, "pw-123456")) === null)
  const accepted = await acceptPortalInvite(invite.token, "pw-123456")
  check("accept activates the account", accepted !== null)
  const sess = await portalLogin(`client-${stamp}@acme.co`, "pw-123456")
  check("login returns a session scoped to customer A", sess?.customerId === custA.id, sess?.customerId)
  check("wrong password is rejected", (await portalLogin(`client-${stamp}@acme.co`, "nope")) === null)
  check("a STAFF account cannot log in to the portal", (await portalLogin(`mgr-${stamp}@t.co`, "x")) === null)
  check("expired/invalid invite token is rejected", (await acceptPortalInvite("bogus-token", "pw-123456")) === null)

  console.log("Dashboard shows ONLY the user's own customer data:")
  const dash = await getPortalDashboard(org.id, custA.id)
  const blob = JSON.stringify(dash)
  check("includes customer A's completed job", blob.includes("A nightly"))
  check("includes customer A's upcoming job", blob.includes("A upcoming"))
  check("does NOT include customer B's job", !blob.includes("B SECRET job"))
  check("does NOT include customer B's issue", !blob.includes("B SECRET issue"))
  check("does NOT include customer B's name anywhere", !blob.includes("Customer B SECRET"))
  check("invoices are only customer A's (one SENT invoice)", dash.invoices.length === 1)
  check("inspections are only customer A's (the 92 PASS, not the 41 FAIL)", dash.inspections.length === 1 && dash.inspections[0].score === 92)

  console.log("Never exposes pay/labor/margins/other employees:")
  check("no pay rate leaks (99.99)", !blob.includes("99.99"))
  check("no employee name leaks (Secret Cleaner)", !blob.includes("Secret Cleaner"))
  check("no sensitive keys in the payload", !/payRate|laborCost|margin|assignments|inspectorId|uploadedById/.test(blob))

  console.log("Report-issue is constrained to the user's own sites:")
  const okIssue = await reportPortalIssue(org.id, custA.id, accepted!.userId, { serviceLocationId: siteA.id, description: "Spill in lobby" })
  check("can report an issue on own site (source CUSTOMER)", !!okIssue)
  const created = await systemDb.issue.findUniqueOrThrow({ where: { id: okIssue!.id } })
  check("issue is tagged source=CUSTOMER", created.source === "CUSTOMER")
  const crossErr = await threw(() => reportPortalIssue(org.id, custA.id, accepted!.userId, { serviceLocationId: siteB.id, description: "hack" }))
  check("CANNOT report an issue against another customer's site", crossErr !== null)
  const leaked = await systemDb.issue.findFirst({ where: { serviceLocationId: siteB.id, description: "hack" } })
  check("no cross-customer issue row was created", leaked === null)

  console.log("DIRECT-BY-ID attack: as customer A, request B's records by their real IDs:")
  // Sanity: B's rows really exist (valid ids), so a null below is isolation, not a bad id.
  check("B's invoice/job/inspection/photo really exist at the org level", !!(await systemDb.invoice.findUnique({ where: { id: invB.id } })) && !!(await systemDb.job.findUnique({ where: { id: jobB.id } })) && !!(await systemDb.inspection.findUnique({ where: { id: inspB.id } })) && !!(await systemDb.jobPhoto.findUnique({ where: { id: photoB.id } })))
  check("GET B's invoice by id as A → null (not a filtered object)", (await getPortalInvoiceById(org.id, custA.id, invB.id)) === null)
  check("GET B's job by id as A → null", (await getPortalJobById(org.id, custA.id, jobB.id)) === null)
  check("GET B's inspection by id as A → null", (await getPortalInspectionById(org.id, custA.id, inspB.id)) === null)
  check("GET B's photo by id as A → null", (await getPortalPhoto(org.id, custA.id, photoB.id)) === null)
  // And A's own records by id ARE retrievable (proves the by-id path works at all).
  check("GET A's own invoice by id as A → returned", (await getPortalInvoiceById(org.id, custA.id, (await systemDb.invoice.findFirstOrThrow({ where: { customerId: custA.id } })).id)) !== null)

  console.log("Proof photos are isolated by customer:")
  check("own photo is retrievable", (await getPortalPhoto(org.id, custA.id, photoA.id)) !== null)
  check("another customer's photo is NOT retrievable", (await getPortalPhoto(org.id, custA.id, photoB.id)) === null)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL PORTAL SECURITY CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
