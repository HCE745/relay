import { LegalPage } from "@/components/legal/legal-page"

export const metadata = {
  title: "Security Policy — Relay",
}

export default function SecurityPage() {
  return (
    <LegalPage title="Security Policy" lastUpdated="June 1, 2025">
      <p>
        The security of your data is a top priority at Relay. This policy describes the technical and organizational
        measures we implement to protect your information.
      </p>

      <h2 id="infrastructure">1. Infrastructure Security</h2>
      <h3 id="hosting">1.1 Hosting</h3>
      <p>
        Relay is hosted on cloud infrastructure provided by Supabase and Vercel, which maintain SOC 2 Type II
        compliance and implement comprehensive physical and environmental security controls at their data centers.
      </p>
      <h3 id="network">1.2 Network Security</h3>
      <p>
        All data in transit is encrypted using TLS 1.2 or higher. We enforce HTTPS for all connections to the Service
        and reject insecure connections. Our infrastructure is protected by firewalls, and network access is restricted
        to authorized personnel only.
      </p>
      <h3 id="database">1.3 Database Security</h3>
      <p>
        Customer data is stored in PostgreSQL databases with encryption at rest. Row-level security is enforced to
        ensure that each organization can only access its own data. Database access is restricted to application
        services and authorized engineering personnel.
      </p>

      <h2 id="application-security">2. Application Security</h2>
      <h3 id="authentication">2.1 Authentication</h3>
      <p>
        User passwords are hashed using bcrypt with a work factor of 12. Session tokens are cryptographically signed
        JWTs stored in httpOnly cookies, which are inaccessible to JavaScript. Sessions expire after 7 days of
        inactivity.
      </p>
      <h3 id="authorization">2.2 Authorization</h3>
      <p>
        Role-based access control (RBAC) is enforced at the API level. Every request is authenticated and authorized
        against the requesting user&rsquo;s role and organizational membership. Cross-organization data access is
        prevented through strict data isolation controls.
      </p>
      <h3 id="input-validation">2.3 Input Validation</h3>
      <p>
        All user input is validated and sanitized on the server side. We protect against common vulnerabilities
        including SQL injection, cross-site scripting (XSS), and cross-site request forgery (CSRF) using
        industry-standard practices.
      </p>
      <h3 id="rate-limiting">2.4 Rate Limiting</h3>
      <p>
        API endpoints are rate-limited to prevent brute-force attacks and abuse. Authentication endpoints have
        particularly strict rate limits to protect against credential stuffing attacks.
      </p>

      <h2 id="access-controls">3. Access Controls</h2>
      <p>
        Access to production systems is restricted to authorized Relay engineering personnel. We follow the principle
        of least privilege — team members only have access to the systems and data required for their role.
        Production access requires multi-factor authentication and is logged for audit purposes.
      </p>

      <h2 id="monitoring">4. Monitoring and Incident Response</h2>
      <p>
        We continuously monitor our infrastructure and application for security events, anomalies, and potential
        breaches using automated tools and logging. In the event of a confirmed security incident affecting your data,
        we will notify you within 72 hours of discovery, in accordance with applicable regulations.
      </p>

      <h2 id="third-party">5. Third-Party Security</h2>
      <p>
        We assess the security practices of all third-party service providers before engaging them. Key providers
        include:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — PostgreSQL database hosting (SOC 2 Type II)
        </li>
        <li>
          <strong>Vercel</strong> — Application hosting and CDN (SOC 2 Type II)
        </li>
        <li>
          <strong>Anthropic</strong> — AI model API (enterprise-grade data handling)
        </li>
        <li>
          <strong>Stripe</strong> — Payment processing (PCI DSS Level 1)
        </li>
        <li>
          <strong>Sentry</strong> — Error monitoring (SOC 2 Type II)
        </li>
      </ul>

      <h2 id="data-backups">6. Data Backups</h2>
      <p>
        Customer data is backed up automatically on a daily basis. Backups are encrypted and stored in geographically
        redundant locations. We perform regular backup restoration tests to ensure data can be recovered in the event
        of a disaster.
      </p>

      <h2 id="vulnerability-disclosure">7. Vulnerability Disclosure</h2>
      <p>
        We welcome responsible disclosure of security vulnerabilities. If you discover a security issue, please report
        it to us at <a href="mailto:security@getrelay.software">security@getrelay.software</a>. Please do not publicly
        disclose the issue until we have had the opportunity to investigate and address it. We aim to acknowledge
        reports within 48 hours and resolve confirmed vulnerabilities within 30 days.
      </p>

      <h2 id="compliance">8. Compliance</h2>
      <p>
        Our security practices are designed to align with SOC 2 Type II standards and applicable data protection
        regulations. We review and update our security practices regularly to address emerging threats and maintain
        compliance.
      </p>

      <h2 id="contact-security">9. Contact</h2>
      <p>
        Security questions or concerns? Contact our security team at{" "}
        <a href="mailto:security@getrelay.software">security@getrelay.software</a>. For trust and compliance
        inquiries, visit our <a href="/legal/trust">Trust Center</a>.
      </p>
    </LegalPage>
  )
}
