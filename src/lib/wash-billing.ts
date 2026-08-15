import "server-only"
import { stripe } from "@/lib/stripe"
import * as Sentry from "@sentry/nextjs"
import type Stripe from "stripe"

// Synchronize the "additional location" line-item on a Wash Essentials Stripe subscription
// so it reflects `newAdditionalCount` (= total locations minus the 1 included in the base).
//
// CALLER CONTRACT — "Stripe first, then DB":
//   • Call this BEFORE creating or deleting the location in the database.
//   • If it returns a non-null error string, abort the DB write and surface the error to the user.
//   • If the DB write subsequently fails, attempt a compensating Stripe call to restore the
//     previous quantity so billing and operational state stay in sync.
//
// Returns null on success, or a human-readable error string on failure (Sentry is also notified).
export async function syncWashEssentialsLocationBilling(
  subscriptionId: string,
  newAdditionalCount: number,
): Promise<string | null> {
  if (!stripe) return "Payment service not configured."

  const priceId = process.env.STRIPE_PRICE_WE_ADDITIONAL_LOCATION
  if (!priceId) return "Additional-location Stripe price is not configured."

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    })

    const existingItem = subscription.items.data.find(
      (item) => (item.price as Stripe.Price).id === priceId,
    )

    const updateItems: Stripe.SubscriptionUpdateParams.Item[] = []

    if (newAdditionalCount === 0 && existingItem) {
      // Remove the item — org is back to 1 location (base-only billing)
      updateItems.push({ id: existingItem.id, deleted: true })
    } else if (newAdditionalCount > 0 && existingItem) {
      if (existingItem.quantity !== newAdditionalCount) {
        updateItems.push({ id: existingItem.id, quantity: newAdditionalCount })
      }
      // quantity already matches — no Stripe call needed
    } else if (newAdditionalCount > 0 && !existingItem) {
      // First additional location — add the item to the subscription
      updateItems.push({ price: priceId, quantity: newAdditionalCount })
    }

    if (updateItems.length > 0) {
      await stripe.subscriptions.update(subscriptionId, {
        items:              updateItems,
        proration_behavior: "create_prorations",
      })
    }

    return null
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    Sentry.captureException(err, { tags: { subsystem: "wash_billing" } })
    return `Stripe error: ${msg}`
  }
}
