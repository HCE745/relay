import { PrismaClient } from './src/generated/prisma/client.js'
const p = new PrismaClient()

const cfg = await p.imapConfig.findMany({
  select: { id:true, host:true, port:true, smtpHost:true, smtpPort:true,
            emailAddress:true, enabled:true, lastSyncAt:true,
            lastSyncEmailCount:true, encryptedPassword:true, superAdminId:true }
})
console.log('=== IMAP CONFIGS ===')
console.log(JSON.stringify(cfg.map(c => ({
  ...c, encryptedPassword: c.encryptedPassword ? '[SET len='+c.encryptedPassword.length+']' : '[EMPTY]'
})), null, 2))

const count = await p.crmEmail.count()
console.log('\n=== CRM EMAILS total:', count, '===')
const emails = await p.crmEmail.findMany({ take: 10, orderBy: { sentAt: 'desc' } })
console.log(JSON.stringify(emails.map(e=>({
  id:e.id, dir:e.direction, from:e.fromAddress, to:e.toAddress,
  subj:e.subject, sentAt:e.sentAt, source:e.source
})), null, 2))

const dc = await p.demoCall.findMany({ select: { id:true, contactEmail:true, contactName:true } })
console.log('\n=== DEMO CALLS ===')
console.log(JSON.stringify(dc, null, 2))

await p.$disconnect()
