import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { decryptField } from "@/lib/crypto-utils"
import { appendToSentFolder, buildMimeBuffer } from "@/lib/imap-sent"

export const maxDuration = 60
export const dynamic = "force-dynamic"

// ── POST /api/super-admin/crm/emails/retry-sent-folder ────────────────────────
// Finds sent CrmEmail records whose IMAP Sent-folder append previously failed
// and retries the append using the sender's current ImapConfig.  Never re-sends
// the email via SMTP.
//
// Optional body: { emailId?: string }  — retry a single record by ID.
//               (omit to retry all failed records, up to 50 at a time)
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let targetId: string | null = null
  try {
    const body = await req.json() as { emailId?: string }
    targetId = typeof body.emailId === "string" ? body.emailId : null
  } catch { /* empty body */ }

  // Find candidates: sent emails where Sent-folder append hasn't succeeded yet
  const candidates = await prisma.crmEmail.findMany({
    where: {
      direction:        "sent",
      sentFolderSaved:  false,
      ...(targetId ? { id: targetId } : {}),
    },
    select: {
      id:              true,
      fromAddress:     true,
      toAddress:       true,
      subject:         true,
      bodyHtml:        true,
      bodyText:        true,
      messageId:       true,
      sentAt:          true,
      sentBySalesUserId: true,
    },
    take: 50,
    orderBy: { sentAt: "desc" },
  })

  if (candidates.length === 0) {
    return NextResponse.json({ retried: 0, succeeded: 0, failed: 0, message: "No pending records found" })
  }

  let succeeded = 0, failed = 0
  const failures: { id: string; error: string }[] = []

  for (const email of candidates) {
    // Find the ImapConfig for the sender
    const imapCfg = email.sentBySalesUserId
      ? await prisma.imapConfig.findUnique({ where: { salesUserId: email.sentBySalesUserId } })
      : await prisma.imapConfig.findFirst({ where: { superAdminId: session.superAdminId! } })

    if (!imapCfg) {
      const err = "No ImapConfig found for sender"
      await prisma.crmEmail.update({ where: { id: email.id }, data: { sentFolderError: err } })
      failures.push({ id: email.id, error: err })
      failed++
      continue
    }

    let password: string
    try { password = decryptField(imapCfg.encryptedPassword) }
    catch (e) {
      const err = `Decryption failed: ${e instanceof Error ? e.message : String(e)}`
      await prisma.crmEmail.update({ where: { id: email.id }, data: { sentFolderError: err } })
      failures.push({ id: email.id, error: err })
      failed++
      continue
    }

    // Rebuild the MIME from stored fields (no second SMTP send)
    let mimeBuffer: Buffer
    try {
      mimeBuffer = await buildMimeBuffer({
        from:      email.fromAddress,
        to:        email.toAddress,
        subject:   email.subject,
        bodyHtml:  email.bodyHtml,
        bodyText:  email.bodyText,
        messageId: email.messageId ?? `<retry-${email.id}@getrelay.software>`,
        sentAt:    email.sentAt,
      })
    } catch (e) {
      const err = `MIME build failed: ${e instanceof Error ? e.message : String(e)}`
      await prisma.crmEmail.update({ where: { id: email.id }, data: { sentFolderError: err } })
      failures.push({ id: email.id, error: err })
      failed++
      continue
    }

    const result = await appendToSentFolder(
      { host: imapCfg.host, port: imapCfg.port, emailAddress: imapCfg.emailAddress },
      password,
      mimeBuffer,
      email.sentAt,
    )

    if (result.ok) {
      await prisma.crmEmail.update({
        where: { id: email.id },
        data:  { sentFolderSaved: true, sentFolderError: null },
      })
      succeeded++
    } else {
      const err = result.error ?? "IMAP append failed"
      await prisma.crmEmail.update({
        where: { id: email.id },
        data:  { sentFolderError: err },
      })
      failures.push({ id: email.id, error: err })
      failed++
    }
  }

  return NextResponse.json({
    retried:   candidates.length,
    succeeded,
    failed,
    failures: failures.length > 0 ? failures : undefined,
  })
}
