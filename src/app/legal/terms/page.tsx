import { LegalPage } from "@/components/legal/legal-page"

export const metadata = {
  title: "Terms of Service — Relay",
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="June 1, 2025">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the Relay platform and services
        (&ldquo;Service&rdquo;) provided by Relay Software Inc. (&ldquo;Relay&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;). By accessing or using the
        Service, you agree to be bound by these Terms.
      </p>

      <h2 id="acceptance">1. Acceptance of Terms</h2>
      <p>
        By creating an account or using the Service, you confirm that you are at least 18 years old, have the authority
        to bind your organization to these Terms, and agree to these Terms and our Privacy Policy. If you do not agree,
        do not use the Service.
      </p>

      <h2 id="description">2. Description of Service</h2>
      <p>
        Relay is a workplace operations platform designed for frontline teams. The Service includes issue tracking,
        asset management, maintenance scheduling, AI-powered suggestions, analytics, and related features
        (&ldquo;Features&rdquo;). We reserve the right to modify, suspend, or discontinue any Feature at any time with
        reasonable notice.
      </p>

      <h2 id="accounts">3. Accounts and Access</h2>
      <h3 id="account-registration">3.1 Registration</h3>
      <p>
        You must provide accurate, current, and complete information when registering. You are responsible for
        maintaining the security of your account credentials and for all activity that occurs under your account.
      </p>
      <h3 id="account-types">3.2 Account Types</h3>
      <p>
        Relay supports multiple user roles within an organization, including administrators, managers, supervisors, and
        employees. Access to features may vary by role as configured by your organization administrator.
      </p>
      <h3 id="account-security">3.3 Security</h3>
      <p>
        You must notify us immediately at <a href="mailto:security@getrelay.software">security@getrelay.software</a> upon
        discovering any unauthorized use of your account. We are not liable for any loss resulting from unauthorized
        access to your account.
      </p>

      <h2 id="acceptable-use">4. Acceptable Use</h2>
      <p>
        You agree to use the Service only for lawful purposes and in accordance with our{" "}
        <a href="/legal/acceptable-use">Acceptable Use Policy</a>. You may not use the Service to transmit harmful,
        offensive, or illegal content, to interfere with the Service&rsquo;s operation, or to circumvent any security
        measure.
      </p>

      <h2 id="ai-features">5. AI-Powered Features</h2>
      <p>
        Relay includes AI-powered features that provide suggestions, recommendations, and automated insights. These
        outputs are <strong>advisory only</strong> and do not constitute professional advice of any kind. You are solely
        responsible for any decisions made based on AI-generated content. Please review our{" "}
        <a href="/legal/ai-usage">AI and Data Usage Policy</a> for full details.
      </p>

      <h2 id="data">6. Your Data</h2>
      <h3 id="data-ownership">6.1 Ownership</h3>
      <p>
        You retain all rights to the data you submit to the Service (&ldquo;Customer Data&rdquo;). By submitting data,
        you grant us a limited license to process it solely to provide and improve the Service.
      </p>
      <h3 id="data-security">6.2 Security</h3>
      <p>
        We implement industry-standard security measures to protect your data. See our{" "}
        <a href="/legal/security">Security Policy</a> for details.
      </p>
      <h3 id="data-deletion">6.3 Deletion</h3>
      <p>
        Upon termination of your account, we will delete your Customer Data within 90 days, except where retention is
        required by law.
      </p>

      <h2 id="subscriptions">7. Subscriptions and Payment</h2>
      <p>
        Paid subscriptions are billed in advance on a monthly or annual basis. All fees are non-refundable except as
        required by law or as described in our <a href="/legal/billing">Billing Policy</a>. We reserve the right to
        change our pricing with 30 days&rsquo; advance notice.
      </p>

      <h2 id="ip">8. Intellectual Property</h2>
      <p>
        The Service, including all software, designs, trademarks, and content, is owned by Relay and protected by
        intellectual property laws. You may not copy, modify, distribute, or create derivative works without our express
        written permission.
      </p>

      <h2 id="confidentiality">9. Confidentiality</h2>
      <p>
        Each party agrees to keep the other&rsquo;s confidential information secure and not to disclose it to third
        parties without prior written consent, except as required by law.
      </p>

      <h2 id="warranties">10. Disclaimer of Warranties</h2>
      <p>
        THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DISCLAIM ALL
        WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
        NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE.
      </p>

      <h2 id="liability">11. Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, RELAY&rsquo;S TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING FROM THESE
        TERMS OR YOUR USE OF THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID TO US IN THE 12 MONTHS
        BEFORE THE CLAIM, OR (B) $100 USD. WE WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL
        DAMAGES.
      </p>

      <h2 id="indemnification">12. Indemnification</h2>
      <p>
        You agree to indemnify and hold Relay and its officers, directors, employees, and agents harmless from any
        claims, damages, or expenses (including reasonable legal fees) arising from your use of the Service, violation
        of these Terms, or infringement of any third-party rights.
      </p>

      <h2 id="termination">13. Termination</h2>
      <p>
        Either party may terminate these Terms at any time. We may suspend or terminate your access immediately if you
        violate these Terms. Upon termination, your right to use the Service ceases immediately.
      </p>

      <h2 id="governing-law">14. Governing Law</h2>
      <p>
        These Terms are governed by the laws of the State of Delaware, without regard to conflict of law principles. Any
        disputes must be resolved in the state or federal courts located in Delaware.
      </p>

      <h2 id="changes">15. Changes to Terms</h2>
      <p>
        We may update these Terms from time to time. We will notify you of material changes by email or in-app
        notification. Continued use of the Service after changes take effect constitutes acceptance of the revised Terms.
      </p>

      <h2 id="contact">16. Contact</h2>
      <p>
        Questions about these Terms? Contact us at{" "}
        <a href="mailto:legal@getrelay.software">legal@getrelay.software</a>.
      </p>
    </LegalPage>
  )
}
