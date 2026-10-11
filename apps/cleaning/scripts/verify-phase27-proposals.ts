// Phase 27 integration verification: proposals & e-signature.
//  - a proposal snapshots the estimate and gets a public token
//  - a renderable PDF is produced
//  - accepting via the token records the typed-name signature (name/ip/UA/time),
//    runs the atomic estimate→customer conversion, and is immutable afterward
//  - decline works; re-accepting an accepted/declined proposal is refused
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase27-proposals.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { createProposal, sendProposal, getProposalByToken, acceptProposal, declineProposal, proposalPdfByToken } from "../src/lib/data/proposals"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }
async function threw(fn: () => Promise<unknown>) { try { await fn(); return null } catch (e) { return e } }

async function makeEstimate(orgId: string, title: string) {
  return systemDb.estimate.create({
    data: {
      organizationId: orgId, title, status: "SENT", contactName: "Pat Buyer", contactEmail: "pat@buyer.co",
      frequency: "WEEKLY", pricing: "PER_VISIT", rate: "300.00", currency: "USD", subtotal: "300.00", total: "300.00",
      lines: { create: [{ description: "Weekly office clean", quantity: "1", unitRate: "300.00", amount: "300.00" }] },
    },
    select: { id: true },
  })
}

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Prop Co", slug: `pr-${stamp}`, packageTier: "ENTERPRISE", timezone: "UTC" } })
  const mgr = await systemDb.user.create({ data: { organizationId: org.id, name: "Mgr", email: `m-${stamp}@t.co`, password: "x", role: "MANAGER" } })
  const est = await makeEstimate(org.id, "Acme weekly clean")

  console.log("Create + send:")
  const prop = await createProposal(org.id, est.id, "Net 30. Auto-renews annually.", mgr.id)
  check("proposal created with a token + snapshot", !!prop.token && !!prop.snapshot)
  check("createProposal is idempotent per estimate", (await createProposal(org.id, est.id, undefined, mgr.id)).id === prop.id)
  await sendProposal(org.id, prop.id)
  const pub = await getProposalByToken(prop.token)
  check("public view renders snapshot (title + total)", pub?.status === "SENT" && (pub?.snapshot).total === "$300.00")
  const pdf = await proposalPdfByToken(prop.token)
  check("PDF renders (starts with %PDF)", !!pdf && pdf.subarray(0, 4).toString() === "%PDF")

  console.log("\nAccept records signature + converts the estimate (atomic):")
  const r = await acceptProposal(prop.token, { signerName: "Dana Signer", ip: "198.51.100.9", userAgent: "Mozilla/5.0 (test)" })
  check("conversion produced a customer", !!r.customerId)
  const after = await systemDb.proposal.findUniqueOrThrow({ where: { id: prop.id } })
  check("signature recorded (name/ip/UA/time)", after.status === "ACCEPTED" && after.signerName === "Dana Signer" && after.signerIp === "198.51.100.9" && !!after.signedAt && !!after.signerUserAgent)
  check("proposal permanently attached to the created customer", after.convertedCustomerId === r.customerId)
  const estAfter = await systemDb.estimate.findUniqueOrThrow({ where: { id: est.id } })
  check("estimate marked converted (immutable)", !!estAfter.convertedCustomerId)
  check("signed PDF now carries the signature block", !!(await proposalPdfByToken(prop.token)))

  console.log("\nImmutability + guards:")
  check("re-accepting an accepted proposal is refused", (await threw(() => acceptProposal(prop.token, { signerName: "X Y", ip: "1.1.1.1", userAgent: "x" }))) !== null)

  console.log("\nDecline path:")
  const est2 = await makeEstimate(org.id, "Second estimate")
  const prop2 = await createProposal(org.id, est2.id, undefined, mgr.id)
  await sendProposal(org.id, prop2.id)
  await declineProposal(prop2.token)
  check("declined proposal can't then be accepted", (await threw(() => acceptProposal(prop2.token, { signerName: "A B", ip: "1.1.1.1", userAgent: "x" }))) !== null)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL PROPOSAL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
