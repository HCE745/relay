import Stripe from "stripe"

// Singleton — reuse across hot-reloads in development
const globalForStripe = globalThis as unknown as { stripe?: Stripe }

export const stripe =
  globalForStripe.stripe ??
  (process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-05-27.dahlia" })
    : null)

if (process.env.NODE_ENV !== "production" && stripe) {
  globalForStripe.stripe = stripe
}
