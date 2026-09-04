import "server-only"
import { prisma } from "./prisma"
import { htmlToText } from "./html-to-text"

interface FollowUpDraftInput {
  followUpId:   string
  enrollmentId: string
}

interface DraftResult {
  subject:     string
  bodyHtml:    string
  bodyText:    string
}

async function callClaude(prompt: string, maxTokens = 800): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) { console.error("[crm-ai] ANTHROPIC_API_KEY not set"); return null }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "x-api-key":          apiKey,
        "anthropic-version":  "2023-06-01",
        "content-type":       "application/json",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
        messages:   [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error("[crm-ai] Anthropic error:", res.status, body.slice(0, 200))
      return null
    }
    const data = await res.json() as { content: Array<{ type: string; text: string }> }
    return data.content.find(c => c.type === "text")?.text?.trim() ?? null
  } catch (err) {
    console.error("[crm-ai] callClaude failed:", err)
    return null
  }
}

/**
 * Generate a follow-up email draft for a specific CrmFollowUp record.
 * Loads all required context from the DB and calls the AI.
 * Returns subject + body, or null if AI fails.
 */
export async function generateFollowUpDraft(followUpId: string): Promise<DraftResult | null> {
  const followUp = await prisma.crmFollowUp.findUnique({
    where: { id: followUpId },
    include: {
      enrollment: {
        include: {
          sequence: {
            include: {
              steps: { orderBy: { stepNumber: "asc" } },
            },
          },
          demoCall: {
            include: {
              crmEmails: {
                orderBy: { sentAt: "asc" },
                select:  { direction: true, fromAddress: true, toAddress: true, subject: true, bodyText: true, bodyHtml: true, sentAt: true },
              },
              organization: {
                include: {
                  crmNotes: {
                    orderBy: { createdAt: "desc" },
                    take:    10,
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!followUp) return null

  const { enrollment } = followUp
  const { demoCall, sequence } = enrollment
  const step = sequence.steps.find(s => s.stepNumber === followUp.stepNumber)

  // Build email thread context (plain text only for the prompt)
  const threadEmails = demoCall.crmEmails.map(e => {
    const who  = e.direction === "sent" ? "Will (us)" : demoCall.contactName
    const when = new Date(e.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    const body = e.bodyText || htmlToText(e.bodyHtml)
    return `[${when}] ${who}:\nSubject: ${e.subject}\n${body.slice(0, 600)}${body.length > 600 ? "…" : ""}`
  }).join("\n\n---\n\n")

  // CRM notes
  const notes = demoCall.organization?.crmNotes
    .map(n => `[${new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}] ${n.noteText}`)
    .join("\n") ?? ""

  // Days since last contact
  const daysSince = enrollment.lastContactAt
    ? Math.floor((Date.now() - new Date(enrollment.lastContactAt).getTime()) / (1000 * 60 * 60 * 24))
    : null

  // Original email subject for thread continuity
  const initialEmail = demoCall.crmEmails.find(e => e.direction === "sent")
  const originalSubject = initialEmail?.subject ?? "your inquiry"

  // Determine subject
  let subject: string
  if (step?.subjectBehavior === "new" && step.newSubject) {
    subject = step.newSubject
  } else if (step?.subjectBehavior === "re") {
    subject = originalSubject.startsWith("Re:") ? originalSubject : `Re: ${originalSubject}`
  } else {
    subject = originalSubject.startsWith("Re:") ? originalSubject : `Re: ${originalSubject}`
  }

  // Build the full AI prompt
  const prompt = `You are writing a sales follow-up email for Will at Relay (getrelay.software — an operations management platform for multi-location businesses).

CONTACT CONTEXT:
- Name: ${demoCall.contactName}
- Role: ${demoCall.contactRole ?? "unknown"}
- Company: ${demoCall.companyName}
- Industry: ${demoCall.industry ?? "not specified"}
- Team size: ${demoCall.employeeCount ?? "unknown"} employees, ${demoCall.locationCount ?? "unknown"} locations
${demoCall.linkedInUrl ? `- LinkedIn: ${demoCall.linkedInUrl}` : ""}

${demoCall.websiteNotes ? `COMPANY RESEARCH NOTES:\n${demoCall.websiteNotes}\n` : ""}

PAIN POINTS DISCOVERED:
${demoCall.painPoints ?? "Not recorded"}

FEATURES PREVIOUSLY EMPHASIZED:
${demoCall.featuresDiscussed.length > 0 ? demoCall.featuresDiscussed.join(", ") : "Not recorded"}

PREVIOUS OBJECTIONS:
${demoCall.objectionNotes ?? "None recorded"}

DEMO / CALL NOTES:
${demoCall.callNotes ?? "No notes"}

${notes ? `CRM NOTES:\n${notes}\n` : ""}

PREVIOUS EMAIL THREAD:
${threadEmails || "(No previous emails in thread)"}

FOLLOW-UP CONTEXT:
- This is follow-up #${followUp.stepNumber} in the "${sequence.name}" sequence
- Days since last contact: ${daysSince != null ? `${daysSince} days` : "unknown"}
- Sequence step instructions: ${step?.aiInstructions ?? "Write a brief, natural follow-up. Don't repeat the full pitch."}

WRITING RULES (critical — do not break these):
- Write ONLY the email body. No subject line. No signature. No "Best," or "Thanks,".
- Maximum 4 sentences for steps 1-3. Maximum 3 sentences for the final step.
- Reference something specific about ${demoCall.companyName} or their situation — show you remember them.
- Sound like a real person, not a sales bot. Never say "I hope this finds you well", "Just circling back", "touching base", or "following up".
- Do not repeat what was already said in previous emails. Add something new — a different angle, a specific feature, a relevant insight.
- If this is the final step, acknowledge it's your last email and give them an easy out.
- Write in first person as Will.

Write the email body now:`

  const aiBody = await callClaude(prompt, 600)
  if (!aiBody) return null

  // Wrap in simple HTML
  const bodyHtml = aiBody.split("\n\n").map(p =>
    p.trim() ? `<p>${p.replace(/\n/g, "<br>")}</p>` : ""
  ).filter(Boolean).join("\n")

  const bodyText = aiBody

  return { subject, bodyHtml, bodyText }
}

/**
 * Batch-generate drafts for all pending follow-ups that are due today or overdue.
 * Called from the daily cron. Returns counts.
 */
export async function batchGenerateDueDrafts(): Promise<{ generated: number; failed: number; skipped: number }> {
  const now = new Date()

  const duePending = await prisma.crmFollowUp.findMany({
    where: {
      status:      "pending",
      scheduledFor: { lte: now },
      enrollment:  { status: "active" },
    },
    include: {
      enrollment: {
        include: {
          sequence: true,
          demoCall: { select: { contactEmail: true, contactName: true, companyName: true } },
        },
      },
    },
  })

  let generated = 0, failed = 0, skipped = 0

  for (const fu of duePending) {
    // Pre-flight stop checks
    if (fu.enrollment.status !== "active") { skipped++; continue }

    // Check if a reply was received since enrollment
    const replyReceived = fu.enrollment.lastEmailId
      ? await prisma.crmEmail.findFirst({
          where: {
            contactEmail: fu.enrollment.demoCall.contactEmail,
            direction:    "received",
            sentAt:       { gte: fu.enrollment.enrolledAt },
          },
        })
      : null

    if (replyReceived) {
      // Stop enrollment — reply detected
      await prisma.crmEmailSequenceEnrollment.update({
        where: { id: fu.enrollmentId },
        data:  { status: "stopped", stopReason: "reply", stoppedAt: now },
      })
      await prisma.crmFollowUp.update({
        where: { id: fu.id },
        data:  { status: "skipped", errorLog: "Stopped: reply detected" },
      })
      skipped++
      continue
    }

    // Generate AI draft
    const draft = await generateFollowUpDraft(fu.id)
    if (!draft) {
      await prisma.crmFollowUp.update({
        where: { id: fu.id },
        data:  { status: "failed", errorLog: "AI draft generation failed", retryCount: fu.retryCount + 1 },
      })
      failed++
      continue
    }

    const mode = fu.enrollment.mode

    if (mode === "auto_send") {
      // Check global autoSendEnabled setting
      const settings = await prisma.crmSettings.findFirst()
      if (!settings?.autoSendEnabled) {
        // Fall back to review_before_send
        await prisma.crmFollowUp.update({
          where: { id: fu.id },
          data:  {
            status:         "draft_generated",
            draftSubject:   draft.subject,
            draftBodyHtml:  draft.bodyHtml,
            draftBodyText:  draft.bodyText,
            aiGeneratedAt:  now,
          },
        })
        generated++
        continue
      }
      // Auto-send: would send here — but we keep this as draft_generated for safety
      // Actual send happens when the cron calls sendApprovedFollowUp()
      await prisma.crmFollowUp.update({
        where: { id: fu.id },
        data:  {
          status:         "approved",
          draftSubject:   draft.subject,
          draftBodyHtml:  draft.bodyHtml,
          draftBodyText:  draft.bodyText,
          aiGeneratedAt:  now,
          approvedAt:     now,
        },
      })
      generated++
    } else {
      // manual or review_before_send — park as draft_generated
      await prisma.crmFollowUp.update({
        where: { id: fu.id },
        data:  {
          status:         "draft_generated",
          draftSubject:   draft.subject,
          draftBodyHtml:  draft.bodyHtml,
          draftBodyText:  draft.bodyText,
          aiGeneratedAt:  now,
        },
      })
      generated++
    }
  }

  return { generated, failed, skipped }
}
