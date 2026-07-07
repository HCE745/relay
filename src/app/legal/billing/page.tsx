import { LegalPage } from "@/components/legal/legal-page"

export const metadata = {
  title: "Billing Policy — Relay",
}

export default function BillingPage() {
  return (
    <LegalPage title="Billing Policy" lastUpdated="June 1, 2025">
      <p>
        This Billing Policy describes how Relay handles subscriptions, payments, invoicing, and refunds. By subscribing
        to a paid plan, you agree to the terms described here.
      </p>

      <h2 id="plans-pricing">1. Plans and Pricing</h2>
      <p>
        Relay offers multiple subscription tiers designed for organizations of different sizes and needs. Current
        pricing is available on our website. Pricing may vary based on the number of users, locations, and enabled
        feature modules.
      </p>
      <p>
        We reserve the right to change our pricing at any time. We will provide at least <strong>30 days&rsquo;
        advance notice</strong> of any price changes to existing subscribers via email.
      </p>

      <h2 id="free-trial">2. Free Trial</h2>
      <p>
        New accounts receive a <strong>14-day free trial</strong> with access to Relay&rsquo;s core features. No credit
        card is required to start a trial. At the end of the trial period, you must subscribe to a paid plan to
        continue using the Service. Trial data is retained for 90 days after trial expiration to allow you to subscribe
        and pick up where you left off.
      </p>

      <h2 id="billing-cycles">3. Billing Cycles</h2>
      <p>
        Subscriptions are billed in advance on either a <strong>monthly</strong> or <strong>annual</strong> basis,
        depending on your selected billing frequency. Annual plans are typically offered at a discount compared to
        monthly billing.
      </p>
      <p>
        Your billing date is set on the day you first subscribe and recurs on that date each month or year.
      </p>

      <h2 id="payment-methods">4. Payment Methods</h2>
      <p>
        Relay accepts payment via major credit and debit cards (Visa, Mastercard, American Express, Discover) processed
        securely through Stripe. Payment card information is never stored on Relay&rsquo;s servers — all payment data
        is handled directly by Stripe, which is PCI DSS Level 1 compliant.
      </p>

      <h2 id="automatic-renewal">5. Automatic Renewal</h2>
      <p>
        Subscriptions renew automatically at the end of each billing cycle unless cancelled. You will receive an email
        reminder before each renewal. You can cancel auto-renewal at any time from your account settings. Cancellation
        takes effect at the end of the current billing period.
      </p>

      <h2 id="invoices">6. Invoices</h2>
      <p>
        Invoices are generated automatically and emailed to your billing contact after each successful payment. You can
        also access and download invoices from your account&rsquo;s billing settings at any time. For custom invoicing
        arrangements (e.g., net 30 payment terms for Enterprise customers), contact us at{" "}
        <a href="mailto:billing@getrelay.software">billing@getrelay.software</a>.
      </p>

      <h2 id="failed-payments">7. Failed Payments</h2>
      <p>
        If a payment fails, we will notify you by email and attempt to retry the charge up to 3 times over 7 days.
        During this period, your account will remain active. If payment is not resolved within 14 days of the original
        due date, your account may be placed in a read-only state until the outstanding balance is paid.
      </p>

      <h2 id="refunds">8. Refunds</h2>
      <p>
        All subscription fees are non-refundable except in the following circumstances:
      </p>
      <ul>
        <li>
          <strong>Service outage</strong> — if the Service is unavailable for more than 24 consecutive hours due to
          Relay&rsquo;s failure, you may request a prorated credit for the affected period.
        </li>
        <li>
          <strong>Billing errors</strong> — if you are charged in error, please contact us within 30 days and we will
          issue a full refund of the erroneous charge.
        </li>
        <li>
          <strong>Legal requirements</strong> — refunds required by applicable consumer protection laws.
        </li>
      </ul>
      <p>
        To request a refund, contact us at{" "}
        <a href="mailto:billing@getrelay.software">billing@getrelay.software</a> with your account details and a
        description of the issue.
      </p>

      <h2 id="cancellation">9. Cancellation</h2>
      <p>
        You may cancel your subscription at any time from your account settings or by contacting us. Upon cancellation:
      </p>
      <ul>
        <li>Your subscription remains active until the end of the current billing period.</li>
        <li>No further charges will be made.</li>
        <li>Your data will be retained for 90 days after the subscription ends, after which it will be deleted.</li>
      </ul>

      <h2 id="taxes">10. Taxes</h2>
      <p>
        Prices displayed do not include applicable taxes. You are responsible for all taxes, duties, or levies imposed
        by applicable law on your subscription. Where required, Relay will collect and remit applicable sales tax or
        VAT.
      </p>

      <h2 id="upgrades-downgrades">11. Upgrades and Downgrades</h2>
      <p>
        You may upgrade your plan at any time. The upgraded plan takes effect immediately and you will be charged a
        prorated amount for the remainder of the current billing period. Downgrades take effect at the start of the
        next billing period. Certain feature limitations may apply immediately upon downgrading.
      </p>

      <h2 id="contact-billing">12. Contact</h2>
      <p>
        Billing questions? Contact us at{" "}
        <a href="mailto:billing@getrelay.software">billing@getrelay.software</a>.
      </p>
    </LegalPage>
  )
}
