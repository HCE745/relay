import { LegalPage } from "@/components/legal/legal-page"

export const metadata = {
  title: "AI and Data Usage Policy — Relay",
}

export default function AiUsagePage() {
  return (
    <LegalPage title="AI and Data Usage Policy" lastUpdated="June 1, 2025">
      <p>
        Relay incorporates AI-powered features to help frontline teams work more efficiently. This policy explains how
        we use artificial intelligence within the platform, what data is processed, and the limitations you should be
        aware of.
      </p>

      <h2 id="ai-features-overview">1. AI Features in Relay</h2>
      <p>Relay&rsquo;s AI capabilities include:</p>
      <ul>
        <li>
          <strong>Issue classification</strong> — automatically categorizing and prioritizing reported issues based on
          title and description
        </li>
        <li>
          <strong>AI suggestions</strong> — recommending resolution steps, similar past issues, and relevant standard
          operating procedures (SOPs)
        </li>
        <li>
          <strong>Smart routing</strong> — recommending the appropriate team member to handle a given issue based on
          historical patterns and routing rules
        </li>
        <li>
          <strong>Purchase request analysis</strong> — evaluating purchase requests against catalog policies and
          organizational spend limits
        </li>
        <li>
          <strong>Photo analysis</strong> — processing uploaded images to identify issue types, asset conditions, or
          relevant context
        </li>
        <li>
          <strong>Analytics summaries</strong> — generating narrative summaries of operational trends and performance
          metrics
        </li>
      </ul>

      <h2 id="advisory-only">2. AI Outputs Are Advisory Only</h2>
      <p>
        <strong>
          All AI-generated content within Relay — including suggestions, categorizations, priority recommendations,
          routing recommendations, and analytical summaries — is advisory only.
        </strong>
      </p>
      <p>
        AI outputs do not constitute professional advice of any kind, including but not limited to safety, legal,
        medical, financial, or engineering advice. You are solely responsible for reviewing AI suggestions and making
        independent decisions. Never rely on AI outputs as a substitute for qualified professional judgment.
      </p>

      <h2 id="data-processing">3. How Your Data Is Used for AI</h2>
      <h3 id="what-is-processed">3.1 What Is Processed</h3>
      <p>When AI features are active, the following data may be processed:</p>
      <ul>
        <li>Issue titles and descriptions</li>
        <li>Uploaded photos and attachments</li>
        <li>Asset information and maintenance history</li>
        <li>SOP content</li>
        <li>Historical issue resolution data within your organization</li>
        <li>Purchase request details</li>
      </ul>
      <h3 id="how-it-is-processed">3.2 How It Is Processed</h3>
      <p>
        AI features are powered by Anthropic&rsquo;s Claude models. Data submitted for AI processing is sent to
        Anthropic&rsquo;s API under our data processing agreement. Anthropic does not train its models on your data
        submitted through API calls. Data is processed transiently and is not retained by Anthropic beyond the
        immediate request.
      </p>
      <h3 id="data-minimization">3.3 Data Minimization</h3>
      <p>
        We only send the minimum data necessary for each AI feature to function. We do not send personally identifiable
        employee information to AI models unless it is directly relevant to the feature (e.g., routing recommendations
        may include role information but not personal contact details).
      </p>

      <h2 id="opt-out">4. Opting Out of AI Features</h2>
      <p>
        Organization administrators can disable AI suggestions for their entire organization or allow individual users
        to control their own AI preferences. If AI features are disabled, all issue processing, routing, and
        suggestions will rely on manual workflows only.
      </p>
      <p>
        To disable AI features for your organization, go to <strong>Settings &rarr; AI Features</strong> in your Relay
        dashboard, or contact us at{" "}
        <a href="mailto:support@getrelay.software">support@getrelay.software</a>.
      </p>

      <h2 id="accuracy">5. Accuracy and Limitations</h2>
      <p>AI models can make mistakes. Known limitations include:</p>
      <ul>
        <li>Misclassification of issue categories or priorities</li>
        <li>Routing recommendations that do not account for current staff availability</li>
        <li>SOP matches that may not be appropriate for the specific situation</li>
        <li>Photo analysis errors, especially in low-light or ambiguous conditions</li>
        <li>Summaries that may omit important nuance from underlying data</li>
      </ul>
      <p>
        Always review AI-generated content critically. For safety-related issues, always defer to trained safety
        personnel and established protocols.
      </p>

      <h2 id="human-oversight">6. Human Oversight</h2>
      <p>
        Relay is designed so that humans remain in control of all consequential decisions. AI suggestions are
        presented alongside — not instead of — the information you need to make informed choices. Approval workflows,
        escalation policies, and routing rules all require human configuration and can be overridden at any time.
      </p>

      <h2 id="changes-ai">7. Changes to This Policy</h2>
      <p>
        We may update this policy as AI capabilities evolve. Material changes will be communicated by email or in-app
        notification.
      </p>

      <h2 id="contact-ai">8. Contact</h2>
      <p>
        Questions about our AI practices? Contact us at{" "}
        <a href="mailto:privacy@getrelay.software">privacy@getrelay.software</a>.
      </p>
    </LegalPage>
  )
}
