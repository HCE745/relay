import "server-only"
import { createTransport } from "nodemailer"

interface SmtpConfig {
  smtpHost:    string
  smtpPort:    number
  emailAddress: string
  password:    string
  fromName?:   string
}

export interface SmtpSendOptions {
  to:              string
  cc?:             string
  subject:         string
  bodyHtml:        string
  bodyText:        string
  messageId:       string
  inReplyTo?:      string
  unsubscribeUrl?: string
}

export async function sendViaTitanSmtp(
  config:  SmtpConfig,
  options: SmtpSendOptions,
): Promise<Buffer> {
  const from = config.fromName
    ? `"${config.fromName}" <${config.emailAddress}>`
    : config.emailAddress

  const sentAt = new Date()

  const mailOptions = {
    from,
    to:      options.to,
    ...(options.cc ? { cc: options.cc } : {}),
    subject: options.subject,
    html:    options.bodyHtml,
    text:    options.bodyText,
    date:    sentAt,
    headers: {
      "Message-ID": options.messageId,
      ...(options.inReplyTo ? { "In-Reply-To": `<${options.inReplyTo}>`, "References": `<${options.inReplyTo}>` } : {}),
      ...(options.unsubscribeUrl ? {
        "List-Unsubscribe":      `<${options.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      } : {}),
    },
  }

  // Capture the raw MIME before sending (same options → same Message-ID, Date, headers)
  const streamTransport = createTransport({ streamTransport: true, newline: "unix", buffer: true })
  const streamResult = await streamTransport.sendMail(mailOptions) as { message: Buffer }

  const transport = createTransport({
    host:   config.smtpHost,
    port:   config.smtpPort,
    secure: config.smtpPort === 465,
    auth:   { user: config.emailAddress, pass: config.password },
    tls:    { rejectUnauthorized: false },
  })

  await transport.sendMail(mailOptions)
  transport.close()

  return streamResult.message
}
