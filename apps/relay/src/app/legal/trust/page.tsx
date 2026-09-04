import { LegalPage } from "@/components/legal/legal-page"
import Link from "next/link"

export const metadata = {
  title: "Trust Center — Relay",
}

export default function TrustPage() {
  return (
    <LegalPage title="Trust Center" lastUpdated="June 1, 2025">
      <p>
        Relay is built on a foundation of trust. This page provides a central overview of our security, privacy, and
        compliance posture, along with links to our full policies.
      </p>

      <h2 id="our-commitment">1. Our Commitment</h2>
      <p>
        We understand that frontline operations teams depend on Relay for critical workflows. We take seriously our
        responsibility to protect your data, maintain system availability, and be transparent about how we operate.
      </p>

      <h2 id="security-overview">2. Security Overview</h2>
      <p>
        Relay is designed with security at every layer:
      </p>
      <ul>
        <li>All data in transit is encrypted using TLS 1.2+</li>
        <li>Data at rest is encrypted in our PostgreSQL databases</li>
        <li>Row-level security enforces strict data isolation between organizations</li>
        <li>Authentication uses bcrypt-hashed passwords and cryptographically signed session tokens in httpOnly cookies</li>
        <li>Role-based access control (RBAC) limits what each user can see and do</li>
        <li>Rate limiting protects authentication endpoints from brute-force attacks</li>
        <li>All access to production systems is logged and requires MFA</li>
      </ul>
      <p>
        <Link href="/legal/security">Read our full Security Policy →</Link>
      </p>

      <h2 id="data-privacy">3. Data Privacy</h2>
      <p>
        We do not sell your data. Your Customer Data is used solely to provide and improve the Service. We minimize
        data collection, retain data only as long as necessary, and give you control over your data including the
        ability to export or delete it.
      </p>
      <p>
        <Link href="/legal/privacy">Read our full Privacy Policy →</Link>
      </p>

      <h2 id="ai-transparency">4. AI Transparency</h2>
      <p>
        Relay uses AI to help teams work smarter, but we believe in human oversight. All AI outputs are clearly labeled
        as advisory and require human review before action. We process only the minimum data necessary for AI features,
        and organization administrators can disable AI functionality at any time.
      </p>
      <p>
        <Link href="/legal/ai-usage">Read our AI and Data Usage Policy →</Link>
      </p>

      <h2 id="infrastructure-partners">5. Infrastructure Partners</h2>
      <p>We partner with industry-leading providers who maintain strong security and compliance standards:</p>
      <ul>
        <li>
          <strong>Supabase</strong> — PostgreSQL hosting (SOC 2 Type II certified)
        </li>
        <li>
          <strong>Vercel</strong> — Application and CDN hosting (SOC 2 Type II certified)
        </li>
        <li>
          <strong>Anthropic</strong> — AI model API (enterprise data handling agreement; API data not used for training)
        </li>
        <li>
          <strong>Stripe</strong> — Payment processing (PCI DSS Level 1 compliant)
        </li>
        <li>
          <strong>Sentry</strong> — Error monitoring (SOC 2 Type II certified)
        </li>
      </ul>

      <h2 id="uptime">6. Availability</h2>
      <p>
        We target 99.9% monthly uptime for the Relay platform. In the event of an outage or degraded performance, we
        will communicate status updates promptly. Planned maintenance is scheduled during off-peak hours with advance
        notice.
      </p>

      <h2 id="incident-response">7. Incident Response</h2>
      <p>
        In the event of a confirmed security incident that affects your data, we will notify affected organizations
        within 72 hours of discovery. Notifications will include a description of what occurred, what data was
        affected, and what steps we are taking to resolve the issue.
      </p>

      <h2 id="policies">8. Our Policies</h2>
      <ul>
        <li><Link href="/legal/terms">Terms of Service</Link></li>
        <li><Link href="/legal/privacy">Privacy Policy</Link></li>
        <li><Link href="/legal/ai-usage">AI and Data Usage Policy</Link></li>
        <li><Link href="/legal/acceptable-use">Acceptable Use Policy</Link></li>
        <li><Link href="/legal/security">Security Policy</Link></li>
        <li><Link href="/legal/billing">Billing Policy</Link></li>
      </ul>

      <h2 id="contact-trust">9. Contact</h2>
      <p>
        Trust, compliance, or security questions? Contact us at{" "}
        <a href="mailto:trust@getrelay.software">trust@getrelay.software</a> or{" "}
        <a href="mailto:security@getrelay.software">security@getrelay.software</a>.
      </p>
    </LegalPage>
  )
}
