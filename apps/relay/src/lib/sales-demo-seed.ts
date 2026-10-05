import { prisma } from "@/lib/prisma"

export const DEMO_EMAIL = "demo-sales@getrelay.software"
const DEMO_TEMPLATE_PREFIX = "[Demo] "

export async function getDemoUserId(): Promise<string | null> {
  const user = await prisma.salesUser.findUnique({
    where: { email: DEMO_EMAIL },
    select: { id: true },
  })
  return user?.id ?? null
}

export async function clearDemoData(salesUserId: string) {
  // Clear in dependency order
  await prisma.commissionPayment.deleteMany({
    where: { attribution: { commissionOwnerId: salesUserId } },
  })
  await prisma.commissionAttribution.deleteMany({ where: { commissionOwnerId: salesUserId } })
  await prisma.crmTask.deleteMany({ where: { assignedToId: salesUserId } })
  await prisma.crmOpportunity.deleteMany({ where: { assignedToId: salesUserId } })
  await prisma.crmEmail.deleteMany({ where: { sentBySalesUserId: salesUserId } })
  // Also delete received emails to the demo's contacts (linked by demoCallId)
  const demoCalls = await prisma.demoCall.findMany({
    where: { assignedToId: salesUserId },
    select: { id: true },
  })
  const demoCallIds = demoCalls.map(d => d.id)
  if (demoCallIds.length) {
    await prisma.crmEmail.deleteMany({ where: { demoCallId: { in: demoCallIds } } })
  }
  await prisma.demoCall.deleteMany({ where: { assignedToId: salesUserId } })

  const prospectIds = await prisma.prospect.findMany({
    where: { assignedToId: salesUserId },
    select: { id: true },
  })
  const ids = prospectIds.map(p => p.id)
  if (ids.length) {
    await prisma.prospectContact.deleteMany({ where: { prospectId: { in: ids } } })
    await prisma.prospectNote.deleteMany({ where: { prospectId: { in: ids } } })
    await prisma.prospect.deleteMany({ where: { id: { in: ids } } })
  }
  // Delete demo email templates
  await prisma.crmEmailTemplate.deleteMany({
    where: { name: { startsWith: DEMO_TEMPLATE_PREFIX } },
  })
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function daysFromNow(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

export async function seedDemoData(salesUserId: string) {
  // ── Email Templates ──────────────────────────────────────────────────────────

  await prisma.crmEmailTemplate.createMany({ data: [
    {
      name: `${DEMO_TEMPLATE_PREFIX}Manufacturing Cold Outreach`,
      subject: "Maintenance tracking for {{company}}",
      body: `<p>Hi {{first_name}},</p>
<p>I came across {{company}} while researching manufacturers in the area — you're running a solid operation.</p>
<p>I work with a platform called Relay that helps facilities and maintenance teams get off paper-based work orders. Plant managers tell me the biggest wins are cutting reactive maintenance and getting full audit trails for ISO/OSHA without extra paperwork.</p>
<p>Worth a 15-min call to see if it's a fit?</p>
<p>— {{sender_name}}</p>`,
    },
    {
      name: `${DEMO_TEMPLATE_PREFIX}Property Management Outreach`,
      subject: "Maintenance coordination for {{company}}",
      body: `<p>Hi {{first_name}},</p>
<p>I noticed {{company}} manages properties across multiple locations — that's usually where maintenance coordination gets expensive.</p>
<p>We built Relay for PM companies tired of work orders falling through the cracks and vendors showing up without context. PM companies using Relay cut average maintenance response time by 40%.</p>
<p>15 minutes?</p>
<p>— {{sender_name}}</p>`,
    },
    {
      name: `${DEMO_TEMPLATE_PREFIX}Follow-Up #1`,
      subject: "Following up — {{company}}",
      body: `<p>Hi {{first_name}},</p>
<p>Following up on my note from last week. We're working with a few companies in your area and the pattern I hear most often: maintenance logs are split between clipboards, email, and one person's spreadsheet.</p>
<p>Relay fixes that — mobile app for techs, live dashboard for managers, automatic PM schedules. Worth a quick call?</p>
<p>— {{sender_name}}</p>`,
    },
    {
      name: `${DEMO_TEMPLATE_PREFIX}Post-Demo Follow-Up`,
      subject: "Follow-up after our demo — {{company}}",
      body: `<p>Hi {{first_name}},</p>
<p>Really enjoyed our conversation today. Based on what you shared about {{company}}'s current process, I think Relay is a strong fit — especially the mobile work order app and the vendor management piece.</p>
<p>I'm attaching a one-pager with pricing and a few case studies from similar operations. Let me know if you want to loop in anyone else from your team for a full walkthrough.</p>
<p>— {{sender_name}}</p>`,
    },
    {
      name: `${DEMO_TEMPLATE_PREFIX}Trial Check-In`,
      subject: "Trial check-in — how's it going at {{company}}?",
      body: `<p>Hi {{first_name}},</p>
<p>Checking in on the trial — how is the team finding the mobile app? I know getting technicians to adopt new tools can take a minute, so happy to jump on a quick call if there are any questions.</p>
<p>— {{sender_name}}</p>`,
    },
  ]})

  // ── Prospects ────────────────────────────────────────────────────────────────

  const prospects = await Promise.all([
    // 5 early outreach (contacted)
    prisma.prospect.create({ data: {
      companyName: "Midwest Precision Parts", website: "midwestprecision.com",
      industry: "Manufacturing", headquartersCity: "Fort Wayne", headquartersState: "IN",
      employeeCountMin: 50, employeeCountMax: 200, locationsCount: 2,
      aiFitScore: 82, currentCrmStatus: "contacted", source: "ai_research",
      assignedToId: salesUserId, assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(14),
      researchSummary: "Metal precision machining serving automotive and aerospace. Paper-based maintenance tracking pain.",
      contacts: { create: [{ name: "Tom Hadley", title: "Plant Manager", email: "t.hadley@midwestprecision.com" }] },
    }, include: { contacts: true } }),

    prisma.prospect.create({ data: {
      companyName: "Buckeye Metal Fabrication", website: "buckeyemetal.com",
      industry: "Manufacturing", headquartersCity: "Toledo", headquartersState: "OH",
      employeeCountMin: 75, employeeCountMax: 250, locationsCount: 1,
      aiFitScore: 79, currentCrmStatus: "contacted", source: "ai_research",
      assignedToId: salesUserId, assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(10),
      researchSummary: "Custom metal fab for industrial clients. Spreadsheet work order management is a known pain.",
      contacts: { create: [{ name: "Karen Metzger", title: "Operations Director", email: "kmetzger@buckeyemetal.com" }] },
    }, include: { contacts: true } }),

    prisma.prospect.create({ data: {
      companyName: "Hoosier Industrial Equipment", website: "hoosierindustrial.com",
      industry: "Manufacturing", headquartersCity: "South Bend", headquartersState: "IN",
      employeeCountMin: 30, employeeCountMax: 100, locationsCount: 1,
      aiFitScore: 74, currentCrmStatus: "contacted", source: "ai_research",
      assignedToId: salesUserId, assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(8),
      researchSummary: "Equipment repair company. Growing fast, needs better work order and PM scheduling.",
      contacts: { create: [{ name: "Dave Kowalski", title: "Service Manager", email: "dkowalski@hoosierindustrial.com" }] },
    }, include: { contacts: true } }),

    prisma.prospect.create({ data: {
      companyName: "Great Lakes Stamping", website: "greatlakesstamping.com",
      industry: "Manufacturing", headquartersCity: "Findlay", headquartersState: "OH",
      employeeCountMin: 40, employeeCountMax: 150, locationsCount: 1,
      aiFitScore: 76, currentCrmStatus: "contacted", source: "ai_research",
      assignedToId: salesUserId, assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(21),
      researchSummary: "Metal stamping for auto supply chain. ISO audits burden without digital records.",
      contacts: { create: [{ name: "Michelle Braun", title: "Facilities Manager", email: "mbraun@greatlakesstamping.com" }] },
    }, include: { contacts: true } }),

    prisma.prospect.create({ data: {
      companyName: "Spartan Tooling & Die", website: "spartantooling.com",
      industry: "Manufacturing", headquartersCity: "Muncie", headquartersState: "IN",
      employeeCountMin: 25, employeeCountMax: 80, locationsCount: 1,
      aiFitScore: 71, currentCrmStatus: "contacted", source: "ai_research",
      assignedToId: salesUserId, assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(5),
      researchSummary: "Precision tooling manufacturer. Maintenance done on paper; losing traceability between shifts.",
      contacts: { create: [{ name: "Rick Paulson", title: "Plant Manager", email: "rpaulson@spartantooling.com" }] },
    }, include: { contacts: true } }),

    // 3 replied
    prisma.prospect.create({ data: {
      companyName: "Cornerstone Property Management", website: "cornerstonepm.com",
      industry: "Property Management", headquartersCity: "Columbus", headquartersState: "OH",
      employeeCountMin: 20, employeeCountMax: 60, locationsCount: 12,
      aiFitScore: 88, currentCrmStatus: "replied", source: "ai_research",
      assignedToId: salesUserId, assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(18), lastReplyDate: daysAgo(12),
      researchSummary: "Manages 800+ units across central Ohio. Maintenance coordination across properties is a major pain.",
      contacts: { create: [{ name: "Susan Rizzo", title: "Property Manager", email: "srizzo@cornerstonepm.com" }] },
    }, include: { contacts: true } }),

    prisma.prospect.create({ data: {
      companyName: "Prairie Management Group", website: "prairiemanagement.com",
      industry: "Property Management", headquartersCity: "Carmel", headquartersState: "IN",
      employeeCountMin: 15, employeeCountMax: 50, locationsCount: 8,
      aiFitScore: 85, currentCrmStatus: "replied", source: "ai_research",
      assignedToId: salesUserId, assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(22), lastReplyDate: daysAgo(15),
      researchSummary: "Residential PM, 400+ units Carmel/Fishers. Paper work orders and phone calls for maintenance.",
      contacts: { create: [{ name: "Brian Callahan", title: "Operations Director", email: "bcallahan@prairiemanagement.com" }] },
    }, include: { contacts: true } }),

    prisma.prospect.create({ data: {
      companyName: "Ohio Valley Properties", website: "ohiovalleyprops.com",
      industry: "Property Management", headquartersCity: "Dayton", headquartersState: "OH",
      employeeCountMin: 10, employeeCountMax: 35, locationsCount: 6,
      aiFitScore: 80, currentCrmStatus: "replied", source: "ai_research",
      assignedToId: salesUserId, assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(30), lastReplyDate: daysAgo(20),
      researchSummary: "Commercial and mixed-use in greater Dayton. Facilities director mentioned vendor coordination issues.",
      contacts: { create: [{ name: "Amanda Torres", title: "Facilities Director", email: "atorres@ohiovalleyprops.com" }] },
    }, include: { contacts: true } }),

    // 3 high tour engagement (demo_scheduled)
    prisma.prospect.create({ data: {
      companyName: "Lakefront Property Services", website: "lakefrontps.com",
      industry: "Property Management", headquartersCity: "Cleveland", headquartersState: "OH",
      employeeCountMin: 30, employeeCountMax: 100, locationsCount: 18,
      aiFitScore: 92, currentCrmStatus: "demo_scheduled", source: "ai_research",
      assignedToId: salesUserId, assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(35), lastReplyDate: daysAgo(28),
      researchSummary: "Large NE Ohio property group. Toured Relay demo 22 min on maintenance workflows. Strong fit.",
      contacts: { create: [{ name: "James Kopacki", title: "Regional Manager", email: "jkopacki@lakefrontps.com" }] },
    }, include: { contacts: true } }),

    prisma.prospect.create({ data: {
      companyName: "Heartland Property Group", website: "heartlandpg.com",
      industry: "Property Management", headquartersCity: "Indianapolis", headquartersState: "IN",
      employeeCountMin: 20, employeeCountMax: 70, locationsCount: 14,
      aiFitScore: 94, currentCrmStatus: "demo_scheduled", source: "ai_research",
      assignedToId: salesUserId, assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(40), lastReplyDate: daysAgo(33),
      researchSummary: "Established PM serving greater Indianapolis. Demo tour completed all 8 steps. VP Ops on the call.",
      contacts: { create: [{ name: "Carol Jennings", title: "VP Operations", email: "cjennings@heartlandpg.com" }] },
    }, include: { contacts: true } }),

    prisma.prospect.create({ data: {
      companyName: "Central Ohio Facilities", website: "centralohiofacilities.com",
      industry: "Manufacturing", headquartersCity: "Columbus", headquartersState: "OH",
      employeeCountMin: 60, employeeCountMax: 200, locationsCount: 3,
      aiFitScore: 87, currentCrmStatus: "demo_scheduled", source: "ai_research",
      assignedToId: salesUserId, assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(45), lastReplyDate: daysAgo(38),
      researchSummary: "Multi-site industrial facility management. Toured mobile inspection workflows. CMMS replacement.",
      contacts: { create: [{ name: "Frank Deluca", title: "Facilities Manager", email: "fdeluca@centralohio.com" }] },
    }, include: { contacts: true } }),

    // 2 demos scheduled (upcoming)
    prisma.prospect.create({ data: {
      companyName: "Allied Property Partners", website: "alliedpropertypartners.com",
      industry: "Property Management", headquartersCity: "Cincinnati", headquartersState: "OH",
      employeeCountMin: 15, employeeCountMax: 50, locationsCount: 9,
      aiFitScore: 83, currentCrmStatus: "demo_scheduled", source: "ai_research",
      assignedToId: salesUserId, assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(12), lastReplyDate: daysAgo(7),
      researchSummary: "Cincinnati-area PM. Demo call booked for next Tuesday. Contact is decision maker.",
      contacts: { create: [{ name: "Tom Reeves", title: "Managing Partner", email: "treeves@alliedprops.com" }] },
    }, include: { contacts: true } }),

    prisma.prospect.create({ data: {
      companyName: "Indiana Steel Works", website: "indianasteelworks.com",
      industry: "Manufacturing", headquartersCity: "Indianapolis", headquartersState: "IN",
      employeeCountMin: 100, employeeCountMax: 400, locationsCount: 2,
      aiFitScore: 78, currentCrmStatus: "demo_scheduled", source: "ai_research",
      assignedToId: salesUserId, assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(16), lastReplyDate: daysAgo(9),
      researchSummary: "Large steel manufacturer. IT and Ops both on intro call. Scheduling full leadership demo.",
      contacts: { create: [{ name: "Gary Whitmore", title: "VP Manufacturing", email: "gwhitmore@indianasteelworks.com" }] },
    }, include: { contacts: true } }),

    // 1 trial
    prisma.prospect.create({ data: {
      companyName: "Meridian Industrial Services", website: "meridianindustrial.com",
      industry: "Manufacturing", headquartersCity: "Anderson", headquartersState: "IN",
      employeeCountMin: 45, employeeCountMax: 120, locationsCount: 2,
      aiFitScore: 90, currentCrmStatus: "trial", source: "ai_research",
      assignedToId: salesUserId, assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(55), lastReplyDate: daysAgo(48),
      researchSummary: "In 14-day trial. Strong adoption — 4 of 6 techs using mobile app. Decision expected end of month.",
      contacts: { create: [{ name: "Phil Nguyen", title: "Operations Director", email: "pnguyen@meridianindustrial.com" }] },
    }, include: { contacts: true } }),

    // 1 customer (for Closed Won opp)
    prisma.prospect.create({ data: {
      companyName: "Heartland Property Group", website: "heartlandpg.com",
      industry: "Property Management", headquartersCity: "Indianapolis", headquartersState: "IN",
      employeeCountMin: 20, employeeCountMax: 70, locationsCount: 14,
      aiFitScore: 94, currentCrmStatus: "customer", source: "ai_research",
      assignedToId: salesUserId, assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(58), lastReplyDate: daysAgo(50),
      researchSummary: "Converted to paid Professional plan. 14 locations active.",
      contacts: { create: [{ name: "Carol Jennings", title: "VP Operations", email: "cjennings@heartlandpg.com" }] },
    }, include: { contacts: true } }),
  ])

  const [
    p_midwest, p_buckeye, p_hoosier, p_greatlakes, p_spartan,
    p_cornerstone, p_prairie, p_ohiovalley,
    p_lakefront, p_heartland_demo, p_central,
    p_allied, p_indiana,
    p_meridian, p_heartland_customer,
  ] = prospects

  // ── DemoCall Records (feeds Accounts, Pipeline, Leads pages) ─────────────────

  const demoCalls = await Promise.all([
    // New Lead × 2
    prisma.demoCall.create({ data: {
      contactName: "Tom Hadley", contactEmail: "t.hadley@midwestprecision.com",
      companyName: "Midwest Precision Parts", industry: "Manufacturing",
      employeeCount: 120, locationCount: 2, leadSource: "Cold Email",
      callStatus: "New Lead", createdBySAName: "Demo Sales",
      assignedToId: salesUserId, prospectId: p_midwest.id,
      contactRole: "Plant Manager",
      createdAt: daysAgo(14),
    }}),
    prisma.demoCall.create({ data: {
      contactName: "Rick Paulson", contactEmail: "rpaulson@spartantooling.com",
      companyName: "Spartan Tooling & Die", industry: "Manufacturing",
      employeeCount: 45, locationCount: 1, leadSource: "Cold Email",
      callStatus: "New Lead", createdBySAName: "Demo Sales",
      assignedToId: salesUserId, prospectId: p_spartan.id,
      contactRole: "Plant Manager",
      createdAt: daysAgo(5),
    }}),

    // Pending × 1
    prisma.demoCall.create({ data: {
      contactName: "Karen Metzger", contactEmail: "kmetzger@buckeyemetal.com",
      companyName: "Buckeye Metal Fabrication", industry: "Manufacturing",
      employeeCount: 160, locationCount: 1, leadSource: "Cold Email",
      callStatus: "Pending", createdBySAName: "Demo Sales",
      assignedToId: salesUserId, prospectId: p_buckeye.id,
      contactRole: "Operations Director",
      followUpDate: daysFromNow(2),
      createdAt: daysAgo(10),
    }}),

    // Scheduled × 2
    prisma.demoCall.create({ data: {
      contactName: "Tom Reeves", contactEmail: "treeves@alliedprops.com",
      companyName: "Allied Property Partners", industry: "Property Management",
      employeeCount: 28, locationCount: 9, leadSource: "Cold Email",
      callStatus: "Scheduled", createdBySAName: "Demo Sales",
      assignedToId: salesUserId, prospectId: p_allied.id,
      contactRole: "Managing Partner",
      scheduledAt: daysFromNow(2),
      createdAt: daysAgo(12),
    }}),
    prisma.demoCall.create({ data: {
      contactName: "Gary Whitmore", contactEmail: "gwhitmore@indianasteelworks.com",
      companyName: "Indiana Steel Works", industry: "Manufacturing",
      employeeCount: 250, locationCount: 2, leadSource: "Cold Email",
      callStatus: "Scheduled", createdBySAName: "Demo Sales",
      assignedToId: salesUserId, prospectId: p_indiana.id,
      contactRole: "VP Manufacturing",
      scheduledAt: daysFromNow(4),
      createdAt: daysAgo(16),
    }}),

    // Demo Completed × 3
    prisma.demoCall.create({ data: {
      contactName: "James Kopacki", contactEmail: "jkopacki@lakefrontps.com",
      companyName: "Lakefront Property Services", industry: "Property Management",
      employeeCount: 65, locationCount: 18, leadSource: "Cold Email",
      callStatus: "Demo Completed", createdBySAName: "Demo Sales",
      assignedToId: salesUserId, prospectId: p_lakefront.id,
      contactRole: "Regional Manager",
      scheduledAt: daysAgo(22),
      callNotes: "Strong demo. James spent 22 min on maintenance workflows. Very engaged throughout. Sending proposal.",
      painPoints: "Maintenance coordination across 18 properties, vendor communication, response time tracking",
      featuresDiscussed: ["Work Orders", "Vendor Management", "Mobile App", "Analytics Dashboard"],
      createdAt: daysAgo(35),
    }}),
    prisma.demoCall.create({ data: {
      contactName: "Brian Callahan", contactEmail: "bcallahan@prairiemanagement.com",
      companyName: "Prairie Management Group", industry: "Property Management",
      employeeCount: 30, locationCount: 8, leadSource: "Cold Email",
      callStatus: "Demo Completed", createdBySAName: "Demo Sales",
      assignedToId: salesUserId, prospectId: p_prairie.id,
      contactRole: "Operations Director",
      scheduledAt: daysAgo(14),
      callNotes: "Good call. Brian is evaluating 2-3 options. Relay is strongest on mobile UX. Follow up next week.",
      painPoints: "Paper work orders, vendor no-shows, tenant complaints about response time",
      featuresDiscussed: ["Work Orders", "Mobile App", "QR Code Reporting", "Vendor Portal"],
      createdAt: daysAgo(22),
    }}),
    prisma.demoCall.create({ data: {
      contactName: "Frank Deluca", contactEmail: "fdeluca@centralohio.com",
      companyName: "Central Ohio Facilities", industry: "Manufacturing",
      employeeCount: 130, locationCount: 3, leadSource: "Cold Email",
      callStatus: "Demo Completed", createdBySAName: "Demo Sales",
      assignedToId: salesUserId, prospectId: p_central.id,
      contactRole: "Facilities Manager",
      scheduledAt: daysAgo(20),
      callNotes: "Frank is replacing their legacy CMMS. Relay's mobile-first approach resonated. IT director will be on next call.",
      painPoints: "Legacy CMMS too complex, no mobile access for technicians, PM schedules missed",
      featuresDiscussed: ["Preventive Maintenance", "Mobile App", "Asset Management", "Reporting"],
      createdAt: daysAgo(45),
    }}),

    // Trial Active × 1
    prisma.demoCall.create({ data: {
      contactName: "Phil Nguyen", contactEmail: "pnguyen@meridianindustrial.com",
      companyName: "Meridian Industrial Services", industry: "Manufacturing",
      employeeCount: 80, locationCount: 2, leadSource: "Cold Email",
      callStatus: "Trial Active", createdBySAName: "Demo Sales",
      assignedToId: salesUserId, prospectId: p_meridian.id,
      contactRole: "Operations Director",
      scheduledAt: daysAgo(25),
      callNotes: "Trial started. 4 of 6 techs actively using the mobile app. Strong early adoption.",
      painPoints: "Paper-based maintenance logs, difficult to track PM schedules across 2 facilities",
      createdAt: daysAgo(55),
    }}),

    // Converted × 1
    prisma.demoCall.create({ data: {
      contactName: "Carol Jennings", contactEmail: "cjennings@heartlandpg.com",
      companyName: "Heartland Property Group", industry: "Property Management",
      employeeCount: 45, locationCount: 14, leadSource: "Cold Email",
      callStatus: "Converted", createdBySAName: "Demo Sales",
      assignedToId: salesUserId, prospectId: p_heartland_customer.id,
      contactRole: "VP Operations",
      scheduledAt: daysAgo(40),
      callNotes: "Signed on Professional plan. Carol got full exec buy-in. 14 locations onboarding.",
      painPoints: "Maintenance siloed per property, vendor management chaos, no central reporting",
      featuresDiscussed: ["Work Orders", "Multi-Location Dashboard", "Vendor Management", "Reporting", "Mobile App"],
      outcome: "Converted",
      createdAt: daysAgo(58),
    }}),

    // Lost × 1
    prisma.demoCall.create({ data: {
      contactName: "Dave Kowalski", contactEmail: "dkowalski@hoosierindustrial.com",
      companyName: "Hoosier Industrial Equipment", industry: "Manufacturing",
      employeeCount: 60, locationCount: 1, leadSource: "Cold Email",
      callStatus: "Lost", createdBySAName: "Demo Sales",
      assignedToId: salesUserId, prospectId: p_hoosier.id,
      contactRole: "Service Manager",
      scheduledAt: daysAgo(30),
      callNotes: "Lost to a competitor with an existing relationship. Price was also a factor at this size.",
      outcome: "Chose competitor (Limble CMMS)",
      createdAt: daysAgo(45),
    }}),
  ])

  const [
    dc_midwest, dc_spartan, dc_buckeye,
    dc_allied, dc_indiana,
    dc_lakefront, dc_prairie, dc_central,
    dc_meridian, dc_heartland_converted, dc_hoosier_lost,
  ] = demoCalls

  // ── CrmEmails ────────────────────────────────────────────────────────────────

  const out1 = (name: string, company: string, contact: string) =>
    `<p>Hi ${contact},</p><p>I came across ${company} while researching manufacturers in the area — you're running a solid operation.</p><p>I work with a platform called Relay that helps facilities and maintenance teams get off paper-based work orders. Plant managers tell me the biggest wins are cutting reactive maintenance and getting full audit trails for ISO/OSHA without extra paperwork.</p><p>Worth a 15-min call?</p><p>— ${name}</p>`

  const out2 = (name: string, company: string, contact: string) =>
    `<p>Hi ${contact},</p><p>Following up on my note from last week. The pattern I see most often: maintenance logs split between clipboards, email, and one person's spreadsheet. When something breaks at 2am nobody knows what was last done on that machine.</p><p>Relay fixes that specifically — mobile app for techs, live dashboard for managers, automatic PM schedules. I think there's a clear fit with ${company}.</p><p>15 minutes this week?</p><p>— ${name}</p>`

  const reply = (contact: string) =>
    `<p>Thanks for reaching out. We've actually been looking at options for modernizing our maintenance process. Happy to hop on a call — are you free Thursday afternoon?</p><p>— ${contact}</p>`

  const followReply = (name: string, contact: string) =>
    `<p>Great, ${contact}! Thursday at 2pm works perfectly. I'll send a calendar invite with a short agenda.</p><p>Talk then!</p><p>— ${name}</p>`

  const pm1 = (name: string, company: string, contact: string) =>
    `<p>Hi ${contact},</p><p>I noticed ${company} manages properties across multiple locations — that's usually where maintenance coordination gets expensive.</p><p>We built Relay for PM companies tired of work orders falling through the cracks. PM companies using Relay cut average maintenance response time by 40%.</p><p>15 minutes?</p><p>— ${name}</p>`

  const postDemo = (name: string, company: string, contact: string) =>
    `<p>Hi ${contact},</p><p>Really enjoyed our conversation today. Based on what you shared about ${company}'s current process, I think Relay is a strong fit — especially mobile work orders and vendor management.</p><p>I'm attaching a one-pager with pricing and a few case studies from similar operations.</p><p>— ${name}</p>`

  const demoName = "Demo Sales"

  await Promise.all([
    // Midwest Precision - linked to dc_midwest
    prisma.crmEmail.create({ data: {
      contactEmail: "t.hadley@midwestprecision.com", direction: "sent",
      fromAddress: DEMO_EMAIL, toAddress: "t.hadley@midwestprecision.com",
      subject: "Maintenance tracking for Midwest Precision Parts?",
      bodyHtml: out1(demoName, "Midwest Precision Parts", "Tom"), bodyText: "",
      sentAt: daysAgo(14), source: "compose", sentBySalesUserId: salesUserId,
      demoCallId: dc_midwest.id,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: "t.hadley@midwestprecision.com", direction: "sent",
      fromAddress: DEMO_EMAIL, toAddress: "t.hadley@midwestprecision.com",
      subject: "Following up — Midwest Precision",
      bodyHtml: out2(demoName, "Midwest Precision Parts", "Tom"), bodyText: "",
      sentAt: daysAgo(7), source: "compose", sentBySalesUserId: salesUserId,
      demoCallId: dc_midwest.id, followUpDate: daysAgo(4),
    }}),

    // Buckeye Metal - linked to dc_buckeye
    prisma.crmEmail.create({ data: {
      contactEmail: "kmetzger@buckeyemetal.com", direction: "sent",
      fromAddress: DEMO_EMAIL, toAddress: "kmetzger@buckeyemetal.com",
      subject: "Digital work orders for Buckeye Metal Fabrication",
      bodyHtml: out1(demoName, "Buckeye Metal Fabrication", "Karen"), bodyText: "",
      sentAt: daysAgo(10), source: "compose",
      openedAt: daysAgo(9), openCount: 2, lastOpenedAt: daysAgo(8),
      sentBySalesUserId: salesUserId, demoCallId: dc_buckeye.id,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: "kmetzger@buckeyemetal.com", direction: "sent",
      fromAddress: DEMO_EMAIL, toAddress: "kmetzger@buckeyemetal.com",
      subject: "Quick follow-up — Buckeye Metal",
      bodyHtml: out2(demoName, "Buckeye Metal Fabrication", "Karen"), bodyText: "",
      sentAt: daysAgo(3), source: "compose", sentBySalesUserId: salesUserId,
      demoCallId: dc_buckeye.id, followUpDate: daysAgo(1),
    }}),

    // Spartan - linked to dc_spartan
    prisma.crmEmail.create({ data: {
      contactEmail: "rpaulson@spartantooling.com", direction: "sent",
      fromAddress: DEMO_EMAIL, toAddress: "rpaulson@spartantooling.com",
      subject: "Shift-to-shift maintenance handoff — Spartan Tooling",
      bodyHtml: out1(demoName, "Spartan Tooling & Die", "Rick"), bodyText: "",
      sentAt: daysAgo(5), source: "compose", sentBySalesUserId: salesUserId,
      demoCallId: dc_spartan.id, followUpDate: daysFromNow(2),
    }}),

    // Great Lakes - no demoCall (prospect only)
    prisma.crmEmail.create({ data: {
      contactEmail: "mbraun@greatlakesstamping.com", direction: "sent",
      fromAddress: DEMO_EMAIL, toAddress: "mbraun@greatlakesstamping.com",
      subject: "ISO audit trail — Great Lakes Stamping",
      bodyHtml: out1(demoName, "Great Lakes Stamping", "Michelle"), bodyText: "",
      sentAt: daysAgo(21), source: "compose", sentBySalesUserId: salesUserId,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: "mbraun@greatlakesstamping.com", direction: "sent",
      fromAddress: DEMO_EMAIL, toAddress: "mbraun@greatlakesstamping.com",
      subject: "Re: ISO audit trail — checking in",
      bodyHtml: out2(demoName, "Great Lakes Stamping", "Michelle"), bodyText: "",
      sentAt: daysAgo(14), source: "compose", sentBySalesUserId: salesUserId,
      followUpDate: daysAgo(7),
    }}),

    // Cornerstone PM - reply thread, no demoCall linked
    prisma.crmEmail.create({ data: {
      contactEmail: "srizzo@cornerstonepm.com", direction: "sent",
      fromAddress: DEMO_EMAIL, toAddress: "srizzo@cornerstonepm.com",
      subject: "Maintenance coordination for Cornerstone Property Management",
      bodyHtml: pm1(demoName, "Cornerstone Property Management", "Susan"), bodyText: "",
      sentAt: daysAgo(18), source: "compose",
      openedAt: daysAgo(17), openCount: 3, lastOpenedAt: daysAgo(13),
      sentBySalesUserId: salesUserId,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: "srizzo@cornerstonepm.com", direction: "received",
      fromAddress: "srizzo@cornerstonepm.com", toAddress: DEMO_EMAIL,
      subject: "Re: Maintenance coordination for Cornerstone Property Management",
      bodyHtml: reply("Susan"), bodyText: "",
      sentAt: daysAgo(12), source: "inbound_webhook", sentBySalesUserId: salesUserId,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: "srizzo@cornerstonepm.com", direction: "sent",
      fromAddress: DEMO_EMAIL, toAddress: "srizzo@cornerstonepm.com",
      subject: "Re: Maintenance coordination — confirmed!",
      bodyHtml: followReply(demoName, "Susan"), bodyText: "",
      sentAt: daysAgo(11), source: "compose", sentBySalesUserId: salesUserId,
    }}),

    // Prairie - linked to dc_prairie, full thread
    prisma.crmEmail.create({ data: {
      contactEmail: "bcallahan@prairiemanagement.com", direction: "sent",
      fromAddress: DEMO_EMAIL, toAddress: "bcallahan@prairiemanagement.com",
      subject: "Work orders for Prairie Management Group",
      bodyHtml: pm1(demoName, "Prairie Management Group", "Brian"), bodyText: "",
      sentAt: daysAgo(22), source: "compose",
      openedAt: daysAgo(21), openCount: 2, lastOpenedAt: daysAgo(16),
      sentBySalesUserId: salesUserId, demoCallId: dc_prairie.id,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: "bcallahan@prairiemanagement.com", direction: "received",
      fromAddress: "bcallahan@prairiemanagement.com", toAddress: DEMO_EMAIL,
      subject: "Re: Work orders for Prairie Management Group",
      bodyHtml: reply("Brian"), bodyText: "",
      sentAt: daysAgo(15), source: "inbound_webhook", sentBySalesUserId: salesUserId,
      demoCallId: dc_prairie.id,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: "bcallahan@prairiemanagement.com", direction: "sent",
      fromAddress: DEMO_EMAIL, toAddress: "bcallahan@prairiemanagement.com",
      subject: "Follow-up after demo — Prairie Management",
      bodyHtml: postDemo(demoName, "Prairie Management Group", "Brian"), bodyText: "",
      sentAt: daysAgo(14), source: "compose", sentBySalesUserId: salesUserId,
      demoCallId: dc_prairie.id, followUpDate: daysAgo(7),
    }}),

    // Ohio Valley - reply thread
    prisma.crmEmail.create({ data: {
      contactEmail: "atorres@ohiovalleyprops.com", direction: "sent",
      fromAddress: DEMO_EMAIL, toAddress: "atorres@ohiovalleyprops.com",
      subject: "Vendor coordination — Ohio Valley Properties",
      bodyHtml: pm1(demoName, "Ohio Valley Properties", "Amanda"), bodyText: "",
      sentAt: daysAgo(30), source: "compose",
      openedAt: daysAgo(29), openCount: 4, lastOpenedAt: daysAgo(21),
      sentBySalesUserId: salesUserId,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: "atorres@ohiovalleyprops.com", direction: "received",
      fromAddress: "atorres@ohiovalleyprops.com", toAddress: DEMO_EMAIL,
      subject: "Re: Vendor coordination — Ohio Valley Properties",
      bodyHtml: reply("Amanda"), bodyText: "",
      sentAt: daysAgo(20), source: "inbound_webhook", sentBySalesUserId: salesUserId,
    }}),

    // Lakefront - linked to dc_lakefront, post-demo follow-up
    prisma.crmEmail.create({ data: {
      contactEmail: "jkopacki@lakefrontps.com", direction: "sent",
      fromAddress: DEMO_EMAIL, toAddress: "jkopacki@lakefrontps.com",
      subject: "Relay for Lakefront Property Services",
      bodyHtml: pm1(demoName, "Lakefront Property Services", "James"), bodyText: "",
      sentAt: daysAgo(35), source: "compose",
      openedAt: daysAgo(34), openCount: 5, lastOpenedAt: daysAgo(28),
      sentBySalesUserId: salesUserId, demoCallId: dc_lakefront.id,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: "jkopacki@lakefrontps.com", direction: "received",
      fromAddress: "jkopacki@lakefrontps.com", toAddress: DEMO_EMAIL,
      subject: "Re: Relay for Lakefront Property Services",
      bodyHtml: reply("James"), bodyText: "",
      sentAt: daysAgo(28), source: "inbound_webhook", sentBySalesUserId: salesUserId,
      demoCallId: dc_lakefront.id,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: "jkopacki@lakefrontps.com", direction: "sent",
      fromAddress: DEMO_EMAIL, toAddress: "jkopacki@lakefrontps.com",
      subject: "Follow-up after demo — Lakefront",
      bodyHtml: postDemo(demoName, "Lakefront Property Services", "James"), bodyText: "",
      sentAt: daysAgo(22), source: "compose", sentBySalesUserId: salesUserId,
      demoCallId: dc_lakefront.id, followUpDate: daysAgo(14),
    }}),

    // Heartland demo prospect - linked to dc_prairie (reuse demo call)
    prisma.crmEmail.create({ data: {
      contactEmail: "cjennings@heartlandpg.com", direction: "sent",
      fromAddress: DEMO_EMAIL, toAddress: "cjennings@heartlandpg.com",
      subject: "Heartland Property Group + Relay",
      bodyHtml: pm1(demoName, "Heartland Property Group", "Carol"), bodyText: "",
      sentAt: daysAgo(40), source: "compose",
      openedAt: daysAgo(39), openCount: 6, lastOpenedAt: daysAgo(25),
      sentBySalesUserId: salesUserId, demoCallId: dc_heartland_converted.id,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: "cjennings@heartlandpg.com", direction: "received",
      fromAddress: "cjennings@heartlandpg.com", toAddress: DEMO_EMAIL,
      subject: "Re: Heartland Property Group + Relay",
      bodyHtml: reply("Carol"), bodyText: "",
      sentAt: daysAgo(33), source: "inbound_webhook", sentBySalesUserId: salesUserId,
      demoCallId: dc_heartland_converted.id,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: "cjennings@heartlandpg.com", direction: "sent",
      fromAddress: DEMO_EMAIL, toAddress: "cjennings@heartlandpg.com",
      subject: "Proposal + next steps — Heartland",
      bodyHtml: postDemo(demoName, "Heartland Property Group", "Carol"), bodyText: "",
      sentAt: daysAgo(26), source: "compose", sentBySalesUserId: salesUserId,
      demoCallId: dc_heartland_converted.id,
    }}),

    // Central Ohio - linked to dc_central
    prisma.crmEmail.create({ data: {
      contactEmail: "fdeluca@centralohio.com", direction: "sent",
      fromAddress: DEMO_EMAIL, toAddress: "fdeluca@centralohio.com",
      subject: "CMMS replacement for Central Ohio Facilities",
      bodyHtml: out1(demoName, "Central Ohio Facilities", "Frank"), bodyText: "",
      sentAt: daysAgo(45), source: "compose",
      openedAt: daysAgo(44), openCount: 3, lastOpenedAt: daysAgo(38),
      sentBySalesUserId: salesUserId, demoCallId: dc_central.id,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: "fdeluca@centralohio.com", direction: "received",
      fromAddress: "fdeluca@centralohio.com", toAddress: DEMO_EMAIL,
      subject: "Re: CMMS replacement for Central Ohio Facilities",
      bodyHtml: reply("Frank"), bodyText: "",
      sentAt: daysAgo(38), source: "inbound_webhook", sentBySalesUserId: salesUserId,
      demoCallId: dc_central.id,
    }}),

    // Allied - linked to dc_allied
    prisma.crmEmail.create({ data: {
      contactEmail: "treeves@alliedprops.com", direction: "sent",
      fromAddress: DEMO_EMAIL, toAddress: "treeves@alliedprops.com",
      subject: "Relay for Allied Property Partners",
      bodyHtml: pm1(demoName, "Allied Property Partners", "Tom"), bodyText: "",
      sentAt: daysAgo(12), source: "compose",
      openedAt: daysAgo(11), openCount: 2, lastOpenedAt: daysAgo(8),
      sentBySalesUserId: salesUserId, demoCallId: dc_allied.id,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: "treeves@alliedprops.com", direction: "received",
      fromAddress: "treeves@alliedprops.com", toAddress: DEMO_EMAIL,
      subject: "Re: Relay for Allied Property Partners",
      bodyHtml: reply("Tom"), bodyText: "",
      sentAt: daysAgo(7), source: "inbound_webhook", sentBySalesUserId: salesUserId,
      demoCallId: dc_allied.id,
    }}),

    // Indiana Steel - linked to dc_indiana
    prisma.crmEmail.create({ data: {
      contactEmail: "gwhitmore@indianasteelworks.com", direction: "sent",
      fromAddress: DEMO_EMAIL, toAddress: "gwhitmore@indianasteelworks.com",
      subject: "Relay for Indiana Steel Works",
      bodyHtml: out1(demoName, "Indiana Steel Works", "Gary"), bodyText: "",
      sentAt: daysAgo(16), source: "compose",
      openedAt: daysAgo(15), openCount: 1, lastOpenedAt: daysAgo(15),
      sentBySalesUserId: salesUserId, demoCallId: dc_indiana.id,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: "gwhitmore@indianasteelworks.com", direction: "received",
      fromAddress: "gwhitmore@indianasteelworks.com", toAddress: DEMO_EMAIL,
      subject: "Re: Relay for Indiana Steel Works",
      bodyHtml: reply("Gary"), bodyText: "",
      sentAt: daysAgo(9), source: "inbound_webhook", sentBySalesUserId: salesUserId,
      demoCallId: dc_indiana.id,
    }}),

    // Meridian trial check-in - linked to dc_meridian
    prisma.crmEmail.create({ data: {
      contactEmail: "pnguyen@meridianindustrial.com", direction: "sent",
      fromAddress: DEMO_EMAIL, toAddress: "pnguyen@meridianindustrial.com",
      subject: "Trial check-in — Meridian Industrial",
      bodyHtml: `<p>Hi Phil,</p><p>Checking in on the trial — how are the team finding the mobile app? From the dashboard, looks like 4 of your techs have completed their first work orders. Great start!</p><p>— ${demoName}</p>`,
      bodyText: "",
      sentAt: daysAgo(4), source: "compose", sentBySalesUserId: salesUserId,
      demoCallId: dc_meridian.id, followUpDate: daysFromNow(1),
    }}),
  ])

  // ── Opportunities ────────────────────────────────────────────────────────────

  const opp1 = await prisma.crmOpportunity.create({ data: {
    title: "Midwest Precision Parts — Relay Essentials",
    prospectId: p_midwest.id, demoCallId: dc_midwest.id,
    assignedToId: salesUserId, stage: "Qualified",
    product: "Relay Essentials", value: 299, estimatedValue: 299, leadSource: "OUTBOUND",
    notes: "Tom seems interested. Need to schedule a demo. Pain point: ISO audit trails.",
    nextStep: "Schedule demo call", nextStepDate: daysFromNow(3),
  }})

  const opp2 = await prisma.crmOpportunity.create({ data: {
    title: "Prairie Management Group — Professional",
    prospectId: p_prairie.id, demoCallId: dc_prairie.id,
    assignedToId: salesUserId, stage: "Demo",
    product: "Relay Professional", value: 399, estimatedValue: 399, leadSource: "OUTBOUND",
    notes: "Brian attended demo, positive feedback. Evaluating vs. competitors.",
    nextStep: "Send comparison one-pager", nextStepDate: daysFromNow(1),
  }})

  const opp3 = await prisma.crmOpportunity.create({ data: {
    title: "Cornerstone Property Management — Professional",
    prospectId: p_cornerstone.id,
    assignedToId: salesUserId, stage: "Proposal",
    product: "Relay Professional", value: 499, estimatedValue: 499, leadSource: "OUTBOUND",
    notes: "Proposal sent covering 12 locations. Susan is pushing internally — needs CFO sign-off.",
    nextStep: "Follow up with Susan on CFO review", nextStepDate: daysFromNow(2),
  }})

  const opp4 = await prisma.crmOpportunity.create({ data: {
    title: "Lakefront Property Services — Professional",
    prospectId: p_lakefront.id, demoCallId: dc_lakefront.id,
    assignedToId: salesUserId, stage: "Negotiating",
    product: "Relay Professional", value: 299, estimatedValue: 299, leadSource: "OUTBOUND",
    notes: "Contract in legal review. James wants a 30-day implementation guarantee.",
    nextStep: "Review revised contract terms", nextStepDate: new Date(),
  }})

  const opp5 = await prisma.crmOpportunity.create({ data: {
    title: "Heartland Property Group — Professional",
    prospectId: p_heartland_customer.id, demoCallId: dc_heartland_converted.id,
    assignedToId: salesUserId, closedById: salesUserId,
    stage: "Closed Won", product: "Relay Professional",
    value: 299, estimatedValue: 299, leadSource: "OUTBOUND",
    commissionEligible: true,
    wonAt: daysAgo(15), closedAt: daysAgo(15),
    notes: "Signed! Carol got full team buy-in. 14 locations onboarding now.",
  }})

  // ── Commission ───────────────────────────────────────────────────────────────

  const attribution = await prisma.commissionAttribution.create({ data: {
    opportunityId: opp5.id, commissionOwnerId: salesUserId,
    commissionRate: 33.00, attributionStatus: "PENDING",
    attributionReason: "NORMAL_CLOSE",
    attributionLockedAt: new Date(daysAgo(15).getTime() + 48 * 60 * 60 * 1000),
    isLocked: true, notes: "Auto-created on Closed Won.",
  }})

  await prisma.commissionPayment.create({ data: {
    attributionId: attribution.id,
    grossRevenue: 299.00, commissionRate: 33.00, commissionAmount: 98.67,
    commissionStatus: "PENDING", paymentReceivedAt: daysAgo(13),
    periodStart: daysAgo(13), periodEnd: daysFromNow(17),
    notes: "First month — Heartland Property Group subscription.",
  }})

  // ── Tasks ────────────────────────────────────────────────────────────────────

  await Promise.all([
    // 2 overdue
    prisma.crmTask.create({ data: {
      opportunityId: opp3.id, assignedToId: salesUserId,
      title: "Follow up with Susan — CFO approval status",
      taskType: "call", dueAt: daysAgo(2), priority: "high",
      notes: "Susan said CFO reviews monthly — need to know if it made the agenda.",
    }}),
    prisma.crmTask.create({ data: {
      prospectId: p_ohiovalley.id, assignedToId: salesUserId,
      title: "Send discovery call agenda to Amanda Torres",
      taskType: "email", dueAt: daysAgo(1), priority: "normal",
    }}),

    // 3 due today
    prisma.crmTask.create({ data: {
      opportunityId: opp4.id, assignedToId: salesUserId,
      title: "Review revised contract — Lakefront Property Services",
      taskType: "contract", dueAt: new Date(), priority: "high",
      notes: "James's legal team sent redlines. Review and respond by EOD.",
    }}),
    prisma.crmTask.create({ data: {
      opportunityId: opp2.id, assignedToId: salesUserId,
      title: "Send competitor comparison to Brian Callahan",
      taskType: "email", dueAt: new Date(), priority: "normal",
    }}),
    prisma.crmTask.create({ data: {
      prospectId: p_meridian.id, demoCallId: dc_meridian.id,
      assignedToId: salesUserId,
      title: "Trial check-in call — Meridian Industrial",
      taskType: "call", dueAt: new Date(), priority: "high",
    }}),

    // 3 upcoming
    prisma.crmTask.create({ data: {
      demoCallId: dc_allied.id, assignedToId: salesUserId,
      title: "Demo call with Tom Reeves — Allied Property Partners",
      taskType: "call", dueAt: daysFromNow(2), priority: "high",
      notes: "Full product walkthrough. Tom is decision maker. Emphasize vendor management.",
    }}),
    prisma.crmTask.create({ data: {
      demoCallId: dc_indiana.id, assignedToId: salesUserId,
      title: "Send pre-demo questionnaire to Gary Whitmore",
      taskType: "email", dueAt: daysFromNow(3), priority: "normal",
    }}),
    prisma.crmTask.create({ data: {
      opportunityId: opp1.id, demoCallId: dc_midwest.id,
      assignedToId: salesUserId,
      title: "Schedule demo with Tom Hadley — Midwest Precision",
      taskType: "call", dueAt: daysFromNow(5), priority: "normal",
    }}),
  ])
}
