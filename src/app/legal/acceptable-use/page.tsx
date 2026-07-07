import { LegalPage } from "@/components/legal/legal-page"

export const metadata = {
  title: "Acceptable Use Policy — Relay",
}

export default function AcceptableUsePage() {
  return (
    <LegalPage title="Acceptable Use Policy" lastUpdated="June 1, 2025">
      <p>
        This Acceptable Use Policy (&ldquo;AUP&rdquo;) describes the rules and restrictions that apply to your use of
        the Relay platform and services. By using Relay, you agree to comply with this AUP. Violations may result in
        suspension or termination of your account.
      </p>

      <h2 id="permitted-use">1. Permitted Use</h2>
      <p>
        You may use Relay solely for legitimate workplace operations management purposes, including but not limited to:
        reporting and tracking workplace issues, managing assets and maintenance, creating and managing standard
        operating procedures, and coordinating team workflows.
      </p>

      <h2 id="prohibited-conduct">2. Prohibited Conduct</h2>
      <p>You must not use Relay to:</p>

      <h3 id="illegal-activity">2.1 Illegal Activity</h3>
      <ul>
        <li>Violate any applicable local, state, national, or international law or regulation</li>
        <li>Transmit any content that is defamatory, obscene, or otherwise illegal</li>
        <li>Facilitate fraud, money laundering, or other financial crimes</li>
        <li>Infringe upon intellectual property rights of others</li>
      </ul>

      <h3 id="harmful-content">2.2 Harmful Content</h3>
      <ul>
        <li>Submit content that contains malware, viruses, or other harmful code</li>
        <li>Distribute spam, unsolicited communications, or phishing attempts</li>
        <li>Post content that harasses, threatens, or discriminates against individuals</li>
        <li>Share content that promotes violence or illegal activities</li>
      </ul>

      <h3 id="security-abuse">2.3 Security and System Abuse</h3>
      <ul>
        <li>Attempt to gain unauthorized access to the Service, other accounts, or related systems</li>
        <li>Interfere with or disrupt the Service&rsquo;s operation, servers, or networks</li>
        <li>Conduct denial-of-service attacks or use bots, scrapers, or automated tools without authorization</li>
        <li>Probe, scan, or test the vulnerability of the Service without explicit written permission</li>
        <li>Circumvent, disable, or interfere with security features</li>
      </ul>

      <h3 id="data-misuse">2.4 Data Misuse</h3>
      <ul>
        <li>Collect or harvest data about other users without their consent</li>
        <li>Use data obtained from the Service for purposes other than your legitimate business needs</li>
        <li>Share, sell, or transfer access to the Service to unauthorized third parties</li>
        <li>Upload sensitive personal data beyond what is necessary for workplace operations</li>
      </ul>

      <h3 id="ai-misuse">2.5 AI Feature Misuse</h3>
      <ul>
        <li>Attempt to manipulate or circumvent AI safety measures</li>
        <li>Use AI outputs as the sole basis for safety-critical decisions without human review</li>
        <li>Submit content designed to extract unintended outputs from AI models (prompt injection)</li>
        <li>Represent AI-generated content as human expert advice to others</li>
      </ul>

      <h2 id="content-standards">3. Content Standards</h2>
      <p>All content submitted to Relay must:</p>
      <ul>
        <li>Be accurate and submitted in good faith</li>
        <li>Be relevant to legitimate workplace operations</li>
        <li>Not contain personal health information beyond what is required for injury reporting</li>
        <li>Not contain payment card numbers, social security numbers, or other highly sensitive personal data</li>
      </ul>

      <h2 id="account-security">4. Account Security Obligations</h2>
      <p>You are responsible for:</p>
      <ul>
        <li>Keeping your credentials confidential and not sharing your account with others</li>
        <li>Promptly notifying us of any unauthorized access or security breach</li>
        <li>Ensuring all users in your organization are aware of and comply with this AUP</li>
        <li>Deactivating accounts for former employees or contractors promptly</li>
      </ul>

      <h2 id="enforcement">5. Enforcement</h2>
      <p>
        We reserve the right to investigate suspected violations of this AUP. Upon discovering a violation, we may take
        any of the following actions at our sole discretion:
      </p>
      <ul>
        <li>Issue a warning</li>
        <li>Temporarily suspend access</li>
        <li>Permanently terminate your account</li>
        <li>Report activity to law enforcement where required or appropriate</li>
      </ul>

      <h2 id="reporting">6. Reporting Violations</h2>
      <p>
        To report suspected violations of this AUP, please contact us at{" "}
        <a href="mailto:trust@getrelay.software">trust@getrelay.software</a>. We take all reports seriously and will
        investigate promptly.
      </p>

      <h2 id="changes-aup">7. Changes to This Policy</h2>
      <p>
        We may update this AUP from time to time. Continued use of the Service after changes take effect constitutes
        acceptance of the revised AUP.
      </p>

      <h2 id="contact-aup">8. Contact</h2>
      <p>
        Questions about this policy? Contact us at{" "}
        <a href="mailto:legal@getrelay.software">legal@getrelay.software</a>.
      </p>
    </LegalPage>
  )
}
