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
  to:         string
  cc?:        string
  subject:    string
  bodyHtml:   string
  bodyText:   string
  messageId:  string
  inReplyTo?: string
}

export async function sendViaTitanSmtp(
  config:  SmtpConfig,
  options: SmtpSendOptions,
): Promise<void> {
  const from = config.fromName
    ? `"${config.fromName}" <${config.emailAddress}>`
    : config.emailAddress

  const transport = createTransport({
    host:   config.smtpHost,
    port:   config.smtpPort,
    secure: config.smtpPort === 465,
    auth:   { user: config.emailAddress, pass: config.password },
    tls:    { rejectUnauthorized: false },
  })

  await transport.sendMail({
    from,
    to:      options.to,
    ...(options.cc ? { cc: options.cc } : {}),
    subject: options.subject,
    html:    options.bodyHtml,
    text:    options.bodyText,
    headers: {
      "Message-ID": options.messageId,
      ...(options.inReplyTo ? { "In-Reply-To": `<${options.inReplyTo}>`, "References": `<${options.inReplyTo}>` } : {}),
    },
  })

  transport.close()
}
