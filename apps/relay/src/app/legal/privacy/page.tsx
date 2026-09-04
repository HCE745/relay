import { LegalPage } from "@/components/legal/legal-page"

export const metadata = {
  title: "Privacy Policy — Relay",
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="June 1, 2025">
      <p>
        This Privacy Policy explains how Relay Software Inc. (&ldquo;Relay&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
        &ldquo;our&rdquo;) collects, uses, and shares information when you use the Relay platform and services
        (&ldquo;Service&rdquo;).
      </p>

      <h2 id="information-we-collect">1. Information We Collect</h2>
      <h3 id="account-information">1.1 Account Information</h3>
      <p>
        When you register, we collect your name, email address, password (hashed), and your organization&rsquo;s name.
        Organization administrators may provide additional information during onboarding.
      </p>
      <h3 id="usage-data">1.2 Usage Data</h3>
      <p>
        We collect information about how you use the Service, including pages visited, features used, and actions taken.
        This data helps us improve the Service and understand user behavior.
      </p>
      <h3 id="content-data">1.3 Content Data</h3>
      <p>
        We store content you create within the Service, including issue reports, asset records, maintenance logs,
        comments, and uploaded files or photos.
      </p>
      <h3 id="technical-data">1.4 Technical Data</h3>
      <p>
        We automatically collect IP addresses, browser type, operating system, device information, and log data when
        you access the Service.
      </p>

      <h2 id="how-we-use">2. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Provide, operate, and improve the Service</li>
        <li>Authenticate your identity and protect account security</li>
        <li>Send transactional communications (e.g., issue notifications, email alerts)</li>
        <li>Provide customer support</li>
        <li>Analyze usage patterns to improve features</li>
        <li>Power AI features (see our <a href="/legal/ai-usage">AI and Data Usage Policy</a>)</li>
        <li>Comply with legal obligations</li>
      </ul>

      <h2 id="sharing">3. How We Share Your Information</h2>
      <p>
        We do not sell your personal information. We may share your information with:
      </p>
      <ul>
        <li>
          <strong>Service providers</strong> — third-party vendors who help us operate the Service (e.g., cloud
          hosting, email delivery, error monitoring). These providers are contractually bound to protect your data.
        </li>
        <li>
          <strong>Within your organization</strong> — information you submit may be visible to other users in your
          organization based on their role and access level.
        </li>
        <li>
          <strong>Legal requirements</strong> — we may disclose information if required by law, regulation, or valid
          legal process.
        </li>
        <li>
          <strong>Business transfers</strong> — in the event of a merger, acquisition, or sale, your information may
          be transferred as part of that transaction, with prior notice to you.
        </li>
      </ul>

      <h2 id="data-retention">4. Data Retention</h2>
      <p>
        We retain your data for as long as your account is active or as needed to provide the Service. Upon account
        deletion, we delete Customer Data within 90 days, unless retention is required by law. Anonymized or aggregated
        data may be retained indefinitely.
      </p>

      <h2 id="security">5. Security</h2>
      <p>
        We implement industry-standard security measures including encryption in transit (TLS), encrypted storage,
        access controls, and regular security assessments. See our <a href="/legal/security">Security Policy</a> for
        full details.
      </p>

      <h2 id="your-rights">6. Your Rights</h2>
      <p>Depending on your jurisdiction, you may have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you</li>
        <li>Correct inaccurate or incomplete data</li>
        <li>Request deletion of your data</li>
        <li>Restrict or object to certain processing</li>
        <li>Data portability (receive your data in a machine-readable format)</li>
        <li>Withdraw consent where processing is based on consent</li>
      </ul>
      <p>
        To exercise your rights, contact us at{" "}
        <a href="mailto:privacy@getrelay.software">privacy@getrelay.software</a>.
      </p>

      <h2 id="cookies">7. Cookies and Tracking</h2>
      <p>
        We use essential cookies to maintain your session and authenticate requests. We do not use third-party
        advertising cookies or sell browsing data. You can configure your browser to refuse cookies, though some
        Service features may not function correctly as a result.
      </p>

      <h2 id="international">8. International Transfers</h2>
      <p>
        The Service is operated in the United States. If you access the Service from outside the US, your data may be
        transferred to and processed in the US. We comply with applicable cross-border data transfer requirements.
      </p>

      <h2 id="children">9. Children&rsquo;s Privacy</h2>
      <p>
        The Service is not directed to individuals under 18. We do not knowingly collect personal information from
        children. If we discover we have collected data from a minor, we will delete it promptly.
      </p>

      <h2 id="changes-privacy">10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of material changes by email or in-app
        notification. The &ldquo;Last updated&rdquo; date at the top of this page reflects when changes were made.
      </p>

      <h2 id="contact-privacy">11. Contact</h2>
      <p>
        Questions or concerns about this policy? Contact our privacy team at{" "}
        <a href="mailto:privacy@getrelay.software">privacy@getrelay.software</a>.
      </p>
    </LegalPage>
  )
}
