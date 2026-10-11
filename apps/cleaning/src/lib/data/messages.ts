import { orgDb } from "../org-db"
import { assertFound } from "./errors"
import { notifyCustomer } from "../notifications/dispatch"

// Two-way customer messaging (Phase 26). One thread per customer, visible to
// staff (customer page) and the customer (portal). A staff message also emails
// the customer; a portal reply lands back in the same thread.

export function listCustomerMessages(orgId: string, customerId: string) {
  return orgDb(orgId).customerMessage.findMany({ where: { customerId }, orderBy: { createdAt: "asc" }, take: 200 })
}

export async function postStaffMessage(orgId: string, customerId: string, authorUserId: string, body: string) {
  const customer = await orgDb(orgId).customer.findFirst({ where: { id: customerId }, select: { id: true } })
  assertFound(customer, "Customer")
  const msg = await orgDb(orgId).customerMessage.create({
    data: { organizationId: orgId, customerId, sender: "STAFF", authorUserId, body, readByStaffAt: new Date() },
  })
  // Best-effort email so the customer knows to check the portal.
  await notifyCustomer(orgId, customerId, "CUSTOMER_MESSAGE", { subject: "New message about your service", body })
  return msg
}

export async function portalPostMessage(orgId: string, customerId: string, authorUserId: string | null, body: string) {
  return orgDb(orgId).customerMessage.create({
    data: { organizationId: orgId, customerId, sender: "CUSTOMER", authorUserId, body, readByCustomerAt: new Date() },
  })
}

export async function markThreadRead(orgId: string, customerId: string, by: "staff" | "customer") {
  const field = by === "staff" ? "readByStaffAt" : "readByCustomerAt"
  await orgDb(orgId).customerMessage.updateMany({
    where: { customerId, [field]: null, sender: by === "staff" ? "CUSTOMER" : "STAFF" },
    data: { [field]: new Date() },
  })
}

/** Count unread customer→staff messages across the org (staff nav badge / dashboard). */
export function countUnreadFromCustomers(orgId: string) {
  return orgDb(orgId).customerMessage.count({ where: { sender: "CUSTOMER", readByStaffAt: null } })
}
