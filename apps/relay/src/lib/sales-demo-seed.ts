import { prisma } from "@/lib/prisma"

const DEMO_EMAIL = "demo-sales@getrelay.software"

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
  await prisma.commissionAttribution.deleteMany({
    where: { commissionOwnerId: salesUserId },
  })
  await prisma.crmTask.deleteMany({ where: { assignedToId: salesUserId } })
  await prisma.crmOpportunity.deleteMany({ where: { assignedToId: salesUserId } })
  await prisma.crmEmail.deleteMany({ where: { sentBySalesUserId: salesUserId } })

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
  // ── Prospects ────────────────────────────────────────────────────────────────

  const prospects = await Promise.all([
    // 5 early outreach (contacted)
    prisma.prospect.create({ data: {
      companyName: "Midwest Precision Parts",
      website: "midwestprecision.com",
      industry: "Manufacturing",
      headquartersCity: "Fort Wayne",
      headquartersState: "IN",
      employeeCountMin: 50,
      employeeCountMax: 200,
      locationsCount: 2,
      aiFitScore: 82,
      currentCrmStatus: "contacted",
      source: "ai_research",
      assignedToId: salesUserId,
      assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(14),
      researchSummary: "Metal precision machining shop serving automotive and aerospace. High paper-based maintenance tracking pain.",
      contacts: { create: [{ name: "Tom Hadley", title: "Plant Manager", email: "t.hadley@midwestprecision.com" }] },
    }, include: { contacts: true } }),

    prisma.prospect.create({ data: {
      companyName: "Buckeye Metal Fabrication",
      website: "buckeyemetal.com",
      industry: "Manufacturing",
      headquartersCity: "Toledo",
      headquartersState: "OH",
      employeeCountMin: 75,
      employeeCountMax: 250,
      locationsCount: 1,
      aiFitScore: 79,
      currentCrmStatus: "contacted",
      source: "ai_research",
      assignedToId: salesUserId,
      assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(10),
      researchSummary: "Custom metal fab for industrial clients. Spreadsheet-based work order management is a known pain point.",
      contacts: { create: [{ name: "Karen Metzger", title: "Operations Director", email: "kmetzger@buckeyemetal.com" }] },
    }, include: { contacts: true } }),

    prisma.prospect.create({ data: {
      companyName: "Hoosier Industrial Equipment",
      website: "hoosierindustrial.com",
      industry: "Manufacturing",
      headquartersCity: "South Bend",
      headquartersState: "IN",
      employeeCountMin: 30,
      employeeCountMax: 100,
      locationsCount: 1,
      aiFitScore: 74,
      currentCrmStatus: "contacted",
      source: "ai_research",
      assignedToId: salesUserId,
      assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(8),
      researchSummary: "Equipment repair and service company. Growing fast, needs better work order and PM scheduling.",
      contacts: { create: [{ name: "Dave Kowalski", title: "Service Manager", email: "dkowalski@hoosierindustrial.com" }] },
    }, include: { contacts: true } }),

    prisma.prospect.create({ data: {
      companyName: "Great Lakes Stamping",
      website: "greatlakesstamping.com",
      industry: "Manufacturing",
      headquartersCity: "Findlay",
      headquartersState: "OH",
      employeeCountMin: 40,
      employeeCountMax: 150,
      locationsCount: 1,
      aiFitScore: 76,
      currentCrmStatus: "contacted",
      source: "ai_research",
      assignedToId: salesUserId,
      assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(21),
      researchSummary: "Metal stamping for automotive supply chain. ISO audits are a recurring burden without digital records.",
      contacts: { create: [{ name: "Michelle Braun", title: "Facilities Manager", email: "mbraun@greatlakesstamping.com" }] },
    }, include: { contacts: true } }),

    prisma.prospect.create({ data: {
      companyName: "Spartan Tooling & Die",
      website: "spartantooling.com",
      industry: "Manufacturing",
      headquartersCity: "Muncie",
      headquartersState: "IN",
      employeeCountMin: 25,
      employeeCountMax: 80,
      locationsCount: 1,
      aiFitScore: 71,
      currentCrmStatus: "contacted",
      source: "ai_research",
      assignedToId: salesUserId,
      assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(5),
      researchSummary: "Precision tooling manufacturer. Maintenance done on paper; losing traceability between shifts.",
      contacts: { create: [{ name: "Rick Paulson", title: "Plant Manager", email: "rpaulson@spartantooling.com" }] },
    }, include: { contacts: true } }),

    // 3 replied prospects
    prisma.prospect.create({ data: {
      companyName: "Cornerstone Property Management",
      website: "cornerstonepm.com",
      industry: "Property Management",
      headquartersCity: "Columbus",
      headquartersState: "OH",
      employeeCountMin: 20,
      employeeCountMax: 60,
      locationsCount: 12,
      aiFitScore: 88,
      currentCrmStatus: "replied",
      source: "ai_research",
      assignedToId: salesUserId,
      assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(18),
      lastReplyDate: daysAgo(12),
      researchSummary: "Manages 800+ units across central Ohio. Maintenance coordination across properties is a major pain — tenants complain about response times.",
      contacts: { create: [{ name: "Susan Rizzo", title: "Property Manager", email: "srizzo@cornerstonepm.com" }] },
    }, include: { contacts: true } }),

    prisma.prospect.create({ data: {
      companyName: "Prairie Management Group",
      website: "prairiemanagement.com",
      industry: "Property Management",
      headquartersCity: "Carmel",
      headquartersState: "IN",
      employeeCountMin: 15,
      employeeCountMax: 50,
      locationsCount: 8,
      aiFitScore: 85,
      currentCrmStatus: "replied",
      source: "ai_research",
      assignedToId: salesUserId,
      assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(22),
      lastReplyDate: daysAgo(15),
      researchSummary: "Residential PM company, 400+ units in Carmel/Fishers area. Currently using paper work orders and phone calls for maintenance.",
      contacts: { create: [{ name: "Brian Callahan", title: "Operations Director", email: "bcallahan@prairiemanagement.com" }] },
    }, include: { contacts: true } }),

    prisma.prospect.create({ data: {
      companyName: "Ohio Valley Properties",
      website: "ohiovalleyprops.com",
      industry: "Property Management",
      headquartersCity: "Dayton",
      headquartersState: "OH",
      employeeCountMin: 10,
      employeeCountMax: 35,
      locationsCount: 6,
      aiFitScore: 80,
      currentCrmStatus: "replied",
      source: "ai_research",
      assignedToId: salesUserId,
      assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(30),
      lastReplyDate: daysAgo(20),
      researchSummary: "Commercial and mixed-use properties in greater Dayton. Facilities director mentioned issues with vendor coordination.",
      contacts: { create: [{ name: "Amanda Torres", title: "Facilities Director", email: "atorres@ohiovalleyprops.com" }] },
    }, include: { contacts: true } }),

    // 3 completed demo tour (high engagement)
    prisma.prospect.create({ data: {
      companyName: "Lakefront Property Services",
      website: "lakefrontps.com",
      industry: "Property Management",
      headquartersCity: "Cleveland",
      headquartersState: "OH",
      employeeCountMin: 30,
      employeeCountMax: 100,
      locationsCount: 18,
      aiFitScore: 92,
      currentCrmStatus: "demo_scheduled",
      source: "ai_research",
      assignedToId: salesUserId,
      assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(35),
      lastReplyDate: daysAgo(28),
      researchSummary: "Large property group in NE Ohio. Toured Relay demo extensively — spent 22 min on maintenance workflows section. Strong fit.",
      contacts: { create: [{ name: "James Kopacki", title: "Regional Manager", email: "jkopacki@lakefrontps.com" }] },
    }, include: { contacts: true } }),

    prisma.prospect.create({ data: {
      companyName: "Heartland Property Group",
      website: "heartlandpg.com",
      industry: "Property Management",
      headquartersCity: "Indianapolis",
      headquartersState: "IN",
      employeeCountMin: 20,
      employeeCountMax: 70,
      locationsCount: 14,
      aiFitScore: 94,
      currentCrmStatus: "demo_scheduled",
      source: "ai_research",
      assignedToId: salesUserId,
      assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(40),
      lastReplyDate: daysAgo(33),
      researchSummary: "Established PM company serving greater Indianapolis. Demo tour showed strong interest — completed all 8 steps. VP of Ops on the call.",
      contacts: { create: [{ name: "Carol Jennings", title: "VP Operations", email: "cjennings@heartlandpg.com" }] },
    }, include: { contacts: true } }),

    prisma.prospect.create({ data: {
      companyName: "Central Ohio Facilities",
      website: "centralohiofacilities.com",
      industry: "Manufacturing",
      headquartersCity: "Columbus",
      headquartersState: "OH",
      employeeCountMin: 60,
      employeeCountMax: 200,
      locationsCount: 3,
      aiFitScore: 87,
      currentCrmStatus: "demo_scheduled",
      source: "ai_research",
      assignedToId: salesUserId,
      assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(45),
      lastReplyDate: daysAgo(38),
      researchSummary: "Multi-site industrial facility management. Toured the mobile inspection workflows — highly engaged. CMMS replacement opportunity.",
      contacts: { create: [{ name: "Frank Deluca", title: "Facilities Manager", email: "fdeluca@centralohio.com" }] },
    }, include: { contacts: true } }),

    // 2 demos scheduled (upcoming)
    prisma.prospect.create({ data: {
      companyName: "Allied Property Partners",
      website: "alliedpropertypartners.com",
      industry: "Property Management",
      headquartersCity: "Cincinnati",
      headquartersState: "OH",
      employeeCountMin: 15,
      employeeCountMax: 50,
      locationsCount: 9,
      aiFitScore: 83,
      currentCrmStatus: "demo_scheduled",
      source: "ai_research",
      assignedToId: salesUserId,
      assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(12),
      lastReplyDate: daysAgo(7),
      researchSummary: "Cincinnati-area PM company. Demo call booked for next Tuesday. Contact is the decision maker.",
      contacts: { create: [{ name: "Tom Reeves", title: "Managing Partner", email: "treeves@alliedprops.com" }] },
    }, include: { contacts: true } }),

    prisma.prospect.create({ data: {
      companyName: "Indiana Steel Works",
      website: "indianasteelworks.com",
      industry: "Manufacturing",
      headquartersCity: "Indianapolis",
      headquartersState: "IN",
      employeeCountMin: 100,
      employeeCountMax: 400,
      locationsCount: 2,
      aiFitScore: 78,
      currentCrmStatus: "demo_scheduled",
      source: "ai_research",
      assignedToId: salesUserId,
      assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(16),
      lastReplyDate: daysAgo(9),
      researchSummary: "Large steel manufacturer. IT and Ops both on the intro call. Scheduling demo for full leadership team next week.",
      contacts: { create: [{ name: "Gary Whitmore", title: "VP Manufacturing", email: "gwhitmore@indianasteelworks.com" }] },
    }, include: { contacts: true } }),

    // 1 trial
    prisma.prospect.create({ data: {
      companyName: "Meridian Industrial Services",
      website: "meridianindustrial.com",
      industry: "Manufacturing",
      headquartersCity: "Anderson",
      headquartersState: "IN",
      employeeCountMin: 45,
      employeeCountMax: 120,
      locationsCount: 2,
      aiFitScore: 90,
      currentCrmStatus: "trial",
      source: "ai_research",
      assignedToId: salesUserId,
      assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(55),
      lastReplyDate: daysAgo(48),
      researchSummary: "Currently in 14-day trial. Strong adoption — 4 of 6 techs using the mobile app. Decision expected by end of month.",
      contacts: { create: [{ name: "Phil Nguyen", title: "Operations Director", email: "pnguyen@meridianindustrial.com" }] },
    }, include: { contacts: true } }),

    // 1 customer
    prisma.prospect.create({ data: {
      companyName: "Heartland Property Group",
      website: "heartlandpg.com",
      industry: "Property Management",
      headquartersCity: "Indianapolis",
      headquartersState: "IN",
      employeeCountMin: 20,
      employeeCountMax: 70,
      locationsCount: 14,
      aiFitScore: 94,
      currentCrmStatus: "customer",
      source: "ai_research",
      assignedToId: salesUserId,
      assignedToName: "Demo Sales",
      lastOutreachDate: daysAgo(58),
      lastReplyDate: daysAgo(50),
      researchSummary: "Converted to paid on Professional plan. 14 locations active. Primary contact is Carol Jennings.",
      contacts: { create: [{ name: "Carol Jennings", title: "VP Operations", email: "cjennings@heartlandpg.com" }] },
    }, include: { contacts: true } }),
  ])

  const [
    p_midwest, p_buckeye, p_hoosier, p_greatlakes, p_spartan,
    p_cornerstone, p_prairie, p_ohiovalley,
    p_lakefront, p_heartland_demo, p_central,
    p_allied, p_indiana,
    p_meridian,
    p_heartland_customer,
  ] = prospects

  // ── CrmEmails ────────────────────────────────────────────────────────────────

  const emailOutreach1 = (name: string, company: string, contact: string): string =>
    `<p>Hi ${contact},</p>
<p>I came across ${company} while researching manufacturers in the area — you're running a solid operation.</p>
<p>I work with a platform called Relay that helps facilities and maintenance teams get off paper-based work orders and into a mobile-first system. Plant managers tell me the biggest wins are cutting reactive maintenance and getting full audit trails for ISO/OSHA without extra paperwork.</p>
<p>Worth a 15-min call to see if it's a fit? Happy to share what similar shops in Indiana/Ohio have done.</p>
<p>— ${name}</p>`

  const emailOutreach2 = (name: string, company: string, contact: string): string =>
    `<p>Hi ${contact},</p>
<p>Following up on my note from last week — just wanted to make sure it didn't get buried.</p>
<p>We're working with a few manufacturers in your area and the pattern I hear most often is the same: maintenance logs are split between clipboards, email, and one person's spreadsheet. When something breaks at 2am, nobody knows what was last done on that machine.</p>
<p>Relay fixes that specifically — mobile app for techs, live dashboard for managers, automatic PM schedules. I think there's a clear fit with ${company}.</p>
<p>15 minutes this week?</p>
<p>— ${name}</p>`

  const emailReply = (contact: string): string =>
    `<p>Thanks for reaching out. We've actually been looking at a few options for modernizing our maintenance process — the paper system is definitely holding us back.</p>
<p>Happy to hop on a call. Are you free Thursday afternoon?</p>
<p>— ${contact}</p>`

  const emailFollowReply = (name: string, contact: string): string =>
    `<p>Great, ${contact}! Thursday at 2pm works perfectly.</p>
<p>I'll send a calendar invite with a short agenda. I'll also pull up a few examples from similar operations so you can see what day-one looks like for a team your size.</p>
<p>Talk then!</p>
<p>— ${name}</p>`

  const emailPropMgmt1 = (name: string, company: string, contact: string): string =>
    `<p>Hi ${contact},</p>
<p>I noticed ${company} manages properties across multiple locations — that's usually where maintenance coordination gets expensive.</p>
<p>We built Relay specifically for property management companies that are tired of tenants calling the wrong person, work orders falling through the cracks, and vendors showing up without the right context.</p>
<p>We've helped PM companies cut their average maintenance response time by 40%. Would love to show you how it works in 15 minutes.</p>
<p>— ${name}</p>`

  const emailDemoFollowUp = (name: string, company: string, contact: string): string =>
    `<p>Hi ${contact},</p>
<p>Really enjoyed our conversation yesterday. Based on what you shared about ${company}'s current process, I think Relay is a strong fit — especially the mobile work order app and the vendor management piece.</p>
<p>I'm attaching a one-pager with pricing and a few case studies from property managers your size. Let me know if you want to loop in anyone else from your team for a full walkthrough.</p>
<p>— ${name}</p>`

  const demoUser = "Demo Sales"

  await Promise.all([
    // Midwest Precision - 2 outreach emails
    prisma.crmEmail.create({ data: {
      contactEmail: p_midwest.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_midwest.contacts[0].email ?? "",
      subject: "Maintenance tracking for Midwest Precision Parts?",
      bodyHtml: emailOutreach1(demoUser, "Midwest Precision Parts", "Tom"),
      bodyText: "",
      sentAt: daysAgo(14),
      source: "compose",
      sentBySalesUserId: salesUserId,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: p_midwest.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_midwest.contacts[0].email ?? "",
      subject: "Re: Maintenance tracking for Midwest Precision Parts?",
      bodyHtml: emailOutreach2(demoUser, "Midwest Precision Parts", "Tom"),
      bodyText: "",
      sentAt: daysAgo(7),
      source: "compose",
      sentBySalesUserId: salesUserId,
    }}),

    // Buckeye Metal - 2 outreach
    prisma.crmEmail.create({ data: {
      contactEmail: p_buckeye.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_buckeye.contacts[0].email ?? "",
      subject: "Digital work orders for Buckeye Metal Fabrication",
      bodyHtml: emailOutreach1(demoUser, "Buckeye Metal Fabrication", "Karen"),
      bodyText: "",
      sentAt: daysAgo(10),
      source: "compose",
      openedAt: daysAgo(9),
      openCount: 2,
      lastOpenedAt: daysAgo(8),
      sentBySalesUserId: salesUserId,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: p_buckeye.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_buckeye.contacts[0].email ?? "",
      subject: "Quick follow-up — Buckeye Metal",
      bodyHtml: emailOutreach2(demoUser, "Buckeye Metal Fabrication", "Karen"),
      bodyText: "",
      sentAt: daysAgo(3),
      source: "compose",
      sentBySalesUserId: salesUserId,
    }}),

    // Hoosier Industrial - 1 outreach
    prisma.crmEmail.create({ data: {
      contactEmail: p_hoosier.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_hoosier.contacts[0].email ?? "",
      subject: "Work order modernization for Hoosier Industrial",
      bodyHtml: emailOutreach1(demoUser, "Hoosier Industrial Equipment", "Dave"),
      bodyText: "",
      sentAt: daysAgo(8),
      source: "compose",
      openedAt: daysAgo(7),
      openCount: 1,
      lastOpenedAt: daysAgo(7),
      sentBySalesUserId: salesUserId,
    }}),

    // Great Lakes Stamping - 2 outreach (older)
    prisma.crmEmail.create({ data: {
      contactEmail: p_greatlakes.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_greatlakes.contacts[0].email ?? "",
      subject: "ISO audit trail — Great Lakes Stamping",
      bodyHtml: emailOutreach1(demoUser, "Great Lakes Stamping", "Michelle"),
      bodyText: "",
      sentAt: daysAgo(21),
      source: "compose",
      sentBySalesUserId: salesUserId,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: p_greatlakes.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_greatlakes.contacts[0].email ?? "",
      subject: "Re: ISO audit trail — checking in",
      bodyHtml: emailOutreach2(demoUser, "Great Lakes Stamping", "Michelle"),
      bodyText: "",
      sentAt: daysAgo(14),
      source: "compose",
      sentBySalesUserId: salesUserId,
    }}),

    // Spartan Tooling - 1 outreach
    prisma.crmEmail.create({ data: {
      contactEmail: p_spartan.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_spartan.contacts[0].email ?? "",
      subject: "Shift-to-shift maintenance handoff — Spartan Tooling",
      bodyHtml: emailOutreach1(demoUser, "Spartan Tooling & Die", "Rick"),
      bodyText: "",
      sentAt: daysAgo(5),
      source: "compose",
      sentBySalesUserId: salesUserId,
    }}),

    // Cornerstone PM - outreach + reply thread
    prisma.crmEmail.create({ data: {
      contactEmail: p_cornerstone.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_cornerstone.contacts[0].email ?? "",
      subject: "Maintenance coordination for Cornerstone Property Management",
      bodyHtml: emailPropMgmt1(demoUser, "Cornerstone Property Management", "Susan"),
      bodyText: "",
      sentAt: daysAgo(18),
      source: "compose",
      openedAt: daysAgo(17),
      openCount: 3,
      lastOpenedAt: daysAgo(13),
      sentBySalesUserId: salesUserId,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: p_cornerstone.contacts[0].email ?? "",
      direction: "received",
      fromAddress: p_cornerstone.contacts[0].email ?? "",
      toAddress: DEMO_EMAIL,
      subject: "Re: Maintenance coordination for Cornerstone Property Management",
      bodyHtml: emailReply("Susan"),
      bodyText: "",
      sentAt: daysAgo(12),
      source: "inbound_webhook",
      sentBySalesUserId: salesUserId,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: p_cornerstone.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_cornerstone.contacts[0].email ?? "",
      subject: "Re: Maintenance coordination for Cornerstone Property Management",
      bodyHtml: emailFollowReply(demoUser, "Susan"),
      bodyText: "",
      sentAt: daysAgo(11),
      source: "compose",
      sentBySalesUserId: salesUserId,
    }}),

    // Prairie Management - outreach + reply thread
    prisma.crmEmail.create({ data: {
      contactEmail: p_prairie.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_prairie.contacts[0].email ?? "",
      subject: "Work orders for Prairie Management Group",
      bodyHtml: emailPropMgmt1(demoUser, "Prairie Management Group", "Brian"),
      bodyText: "",
      sentAt: daysAgo(22),
      source: "compose",
      openedAt: daysAgo(21),
      openCount: 2,
      lastOpenedAt: daysAgo(16),
      sentBySalesUserId: salesUserId,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: p_prairie.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_prairie.contacts[0].email ?? "",
      subject: "Re: Property maintenance — quick follow-up",
      bodyHtml: emailOutreach2(demoUser, "Prairie Management Group", "Brian"),
      bodyText: "",
      sentAt: daysAgo(18),
      source: "compose",
      sentBySalesUserId: salesUserId,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: p_prairie.contacts[0].email ?? "",
      direction: "received",
      fromAddress: p_prairie.contacts[0].email ?? "",
      toAddress: DEMO_EMAIL,
      subject: "Re: Property maintenance — quick follow-up",
      bodyHtml: emailReply("Brian"),
      bodyText: "",
      sentAt: daysAgo(15),
      source: "inbound_webhook",
      sentBySalesUserId: salesUserId,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: p_prairie.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_prairie.contacts[0].email ?? "",
      subject: "Re: Property maintenance — confirmed!",
      bodyHtml: emailFollowReply(demoUser, "Brian"),
      bodyText: "",
      sentAt: daysAgo(14),
      source: "compose",
      sentBySalesUserId: salesUserId,
    }}),

    // Ohio Valley - reply thread
    prisma.crmEmail.create({ data: {
      contactEmail: p_ohiovalley.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_ohiovalley.contacts[0].email ?? "",
      subject: "Vendor coordination — Ohio Valley Properties",
      bodyHtml: emailPropMgmt1(demoUser, "Ohio Valley Properties", "Amanda"),
      bodyText: "",
      sentAt: daysAgo(30),
      source: "compose",
      openedAt: daysAgo(29),
      openCount: 4,
      lastOpenedAt: daysAgo(21),
      sentBySalesUserId: salesUserId,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: p_ohiovalley.contacts[0].email ?? "",
      direction: "received",
      fromAddress: p_ohiovalley.contacts[0].email ?? "",
      toAddress: DEMO_EMAIL,
      subject: "Re: Vendor coordination — Ohio Valley Properties",
      bodyHtml: emailReply("Amanda"),
      bodyText: "",
      sentAt: daysAgo(20),
      source: "inbound_webhook",
      sentBySalesUserId: salesUserId,
    }}),

    // Lakefront - full thread (demo completed)
    prisma.crmEmail.create({ data: {
      contactEmail: p_lakefront.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_lakefront.contacts[0].email ?? "",
      subject: "Relay for Lakefront Property Services",
      bodyHtml: emailPropMgmt1(demoUser, "Lakefront Property Services", "James"),
      bodyText: "",
      sentAt: daysAgo(35),
      source: "compose",
      openedAt: daysAgo(34),
      openCount: 5,
      lastOpenedAt: daysAgo(28),
      sentBySalesUserId: salesUserId,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: p_lakefront.contacts[0].email ?? "",
      direction: "received",
      fromAddress: p_lakefront.contacts[0].email ?? "",
      toAddress: DEMO_EMAIL,
      subject: "Re: Relay for Lakefront Property Services",
      bodyHtml: emailReply("James"),
      bodyText: "",
      sentAt: daysAgo(28),
      source: "inbound_webhook",
      sentBySalesUserId: salesUserId,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: p_lakefront.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_lakefront.contacts[0].email ?? "",
      subject: "Follow-up after demo — Lakefront",
      bodyHtml: emailDemoFollowUp(demoUser, "Lakefront Property Services", "James"),
      bodyText: "",
      sentAt: daysAgo(22),
      source: "compose",
      sentBySalesUserId: salesUserId,
    }}),

    // Heartland demo prospect - full thread
    prisma.crmEmail.create({ data: {
      contactEmail: p_heartland_demo.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_heartland_demo.contacts[0].email ?? "",
      subject: "Heartland Property Group + Relay",
      bodyHtml: emailPropMgmt1(demoUser, "Heartland Property Group", "Carol"),
      bodyText: "",
      sentAt: daysAgo(40),
      source: "compose",
      openedAt: daysAgo(39),
      openCount: 6,
      lastOpenedAt: daysAgo(25),
      sentBySalesUserId: salesUserId,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: p_heartland_demo.contacts[0].email ?? "",
      direction: "received",
      fromAddress: p_heartland_demo.contacts[0].email ?? "",
      toAddress: DEMO_EMAIL,
      subject: "Re: Heartland Property Group + Relay",
      bodyHtml: emailReply("Carol"),
      bodyText: "",
      sentAt: daysAgo(33),
      source: "inbound_webhook",
      sentBySalesUserId: salesUserId,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: p_heartland_demo.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_heartland_demo.contacts[0].email ?? "",
      subject: "Proposal + next steps — Heartland",
      bodyHtml: emailDemoFollowUp(demoUser, "Heartland Property Group", "Carol"),
      bodyText: "",
      sentAt: daysAgo(26),
      followUpDate: daysAgo(19),
      followUpDoneAt: daysAgo(19),
      source: "compose",
      sentBySalesUserId: salesUserId,
    }}),

    // Central Ohio Facilities - thread
    prisma.crmEmail.create({ data: {
      contactEmail: p_central.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_central.contacts[0].email ?? "",
      subject: "CMMS replacement for Central Ohio Facilities",
      bodyHtml: emailOutreach1(demoUser, "Central Ohio Facilities", "Frank"),
      bodyText: "",
      sentAt: daysAgo(45),
      source: "compose",
      openedAt: daysAgo(44),
      openCount: 3,
      lastOpenedAt: daysAgo(38),
      sentBySalesUserId: salesUserId,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: p_central.contacts[0].email ?? "",
      direction: "received",
      fromAddress: p_central.contacts[0].email ?? "",
      toAddress: DEMO_EMAIL,
      subject: "Re: CMMS replacement for Central Ohio Facilities",
      bodyHtml: emailReply("Frank"),
      bodyText: "",
      sentAt: daysAgo(38),
      source: "inbound_webhook",
      sentBySalesUserId: salesUserId,
    }}),

    // Allied - outreach
    prisma.crmEmail.create({ data: {
      contactEmail: p_allied.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_allied.contacts[0].email ?? "",
      subject: "Relay for Allied Property Partners",
      bodyHtml: emailPropMgmt1(demoUser, "Allied Property Partners", "Tom"),
      bodyText: "",
      sentAt: daysAgo(12),
      source: "compose",
      openedAt: daysAgo(11),
      openCount: 2,
      lastOpenedAt: daysAgo(8),
      sentBySalesUserId: salesUserId,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: p_allied.contacts[0].email ?? "",
      direction: "received",
      fromAddress: p_allied.contacts[0].email ?? "",
      toAddress: DEMO_EMAIL,
      subject: "Re: Relay for Allied Property Partners",
      bodyHtml: emailReply("Tom"),
      bodyText: "",
      sentAt: daysAgo(7),
      source: "inbound_webhook",
      sentBySalesUserId: salesUserId,
    }}),

    // Indiana Steel - outreach
    prisma.crmEmail.create({ data: {
      contactEmail: p_indiana.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_indiana.contacts[0].email ?? "",
      subject: "Relay for Indiana Steel Works",
      bodyHtml: emailOutreach1(demoUser, "Indiana Steel Works", "Gary"),
      bodyText: "",
      sentAt: daysAgo(16),
      source: "compose",
      openedAt: daysAgo(15),
      openCount: 1,
      lastOpenedAt: daysAgo(15),
      sentBySalesUserId: salesUserId,
    }}),
    prisma.crmEmail.create({ data: {
      contactEmail: p_indiana.contacts[0].email ?? "",
      direction: "received",
      fromAddress: p_indiana.contacts[0].email ?? "",
      toAddress: DEMO_EMAIL,
      subject: "Re: Relay for Indiana Steel Works",
      bodyHtml: emailReply("Gary"),
      bodyText: "",
      sentAt: daysAgo(9),
      source: "inbound_webhook",
      sentBySalesUserId: salesUserId,
    }}),

    // Meridian - trial outreach
    prisma.crmEmail.create({ data: {
      contactEmail: p_meridian.contacts[0].email ?? "",
      direction: "sent",
      fromAddress: DEMO_EMAIL,
      toAddress: p_meridian.contacts[0].email ?? "",
      subject: "Trial check-in — Meridian Industrial",
      bodyHtml: `<p>Hi Phil,</p><p>Checking in on the trial — how are the team finding the mobile app? I know getting technicians to adopt new tools can take a minute, so happy to hop on a quick call if there are any questions.</p><p>From what I can see in the dashboard, it looks like 4 of your techs have completed their first work orders in Relay. That's a great start.</p><p>— ${demoUser}</p>`,
      bodyText: "",
      sentAt: daysAgo(4),
      source: "compose",
      sentBySalesUserId: salesUserId,
    }}),
  ])

  // ── Opportunities ────────────────────────────────────────────────────────────

  const opp1 = await prisma.crmOpportunity.create({ data: {
    title: "Midwest Precision Parts — Relay Essentials",
    prospectId: p_midwest.id,
    assignedToId: salesUserId,
    stage: "Qualified",
    product: "Relay Essentials",
    value: 299,
    estimatedValue: 299,
    leadSource: "OUTBOUND",
    notes: "Tom seems interested. Need to schedule a demo. Best pain point: ISO audit trails.",
    nextStep: "Schedule demo call",
    nextStepDate: daysFromNow(3),
  }})

  const opp2 = await prisma.crmOpportunity.create({ data: {
    title: "Prairie Management Group — Professional",
    prospectId: p_prairie.id,
    assignedToId: salesUserId,
    stage: "Demo",
    product: "Relay Professional",
    value: 399,
    estimatedValue: 399,
    leadSource: "OUTBOUND",
    notes: "Brian attended demo, positive feedback. Evaluating vs. competitors. They have 8 properties.",
    nextStep: "Send comparison one-pager",
    nextStepDate: daysFromNow(1),
  }})

  const opp3 = await prisma.crmOpportunity.create({ data: {
    title: "Cornerstone Property Management — Professional",
    prospectId: p_cornerstone.id,
    assignedToId: salesUserId,
    stage: "Proposal",
    product: "Relay Professional",
    value: 499,
    estimatedValue: 499,
    leadSource: "OUTBOUND",
    notes: "Proposal sent covering 12 locations. Susan is pushing internally — needs CFO sign-off.",
    nextStep: "Follow up with Susan on CFO review",
    nextStepDate: daysFromNow(2),
  }})

  const opp4 = await prisma.crmOpportunity.create({ data: {
    title: "Lakefront Property Services — Professional",
    prospectId: p_lakefront.id,
    assignedToId: salesUserId,
    stage: "Negotiating",
    product: "Relay Professional",
    value: 299,
    estimatedValue: 299,
    leadSource: "OUTBOUND",
    notes: "Contract in legal review. James wants a 30-day implementation guarantee added.",
    nextStep: "Review revised contract terms",
    nextStepDate: daysFromNow(0),
  }})

  // Closed Won — with commission attribution
  const opp5 = await prisma.crmOpportunity.create({ data: {
    title: "Heartland Property Group — Professional",
    prospectId: p_heartland_customer.id,
    assignedToId: salesUserId,
    closedById: salesUserId,
    stage: "Closed Won",
    product: "Relay Professional",
    value: 299,
    estimatedValue: 299,
    leadSource: "OUTBOUND",
    commissionEligible: true,
    wonAt: daysAgo(15),
    closedAt: daysAgo(15),
    notes: "Signed! Carol got full team buy-in. 14 locations onboarding now.",
  }})

  // Commission attribution for the Closed Won
  const attribution = await prisma.commissionAttribution.create({ data: {
    opportunityId: opp5.id,
    commissionOwnerId: salesUserId,
    commissionRate: 33.00,
    attributionStatus: "PENDING",
    attributionReason: "NORMAL_CLOSE",
    attributionLockedAt: new Date(daysAgo(15).getTime() + 48 * 60 * 60 * 1000),
    isLocked: true,
    notes: "Auto-created on Closed Won.",
  }})

  // Commission payment record ($299/mo → $98.67 @ 33%)
  await prisma.commissionPayment.create({ data: {
    attributionId: attribution.id,
    grossRevenue: 299.00,
    commissionRate: 33.00,
    commissionAmount: 98.67,
    commissionStatus: "PENDING",
    paymentReceivedAt: daysAgo(13),
    periodStart: daysAgo(13),
    periodEnd: daysFromNow(17),
    notes: "First month — Heartland Property Group subscription.",
  }})

  // ── Tasks ────────────────────────────────────────────────────────────────────

  await Promise.all([
    // 2 overdue
    prisma.crmTask.create({ data: {
      opportunityId: opp3.id,
      assignedToId: salesUserId,
      title: "Follow up with Susan — CFO approval status",
      taskType: "call",
      dueAt: daysAgo(2),
      priority: "high",
      notes: "Susan said CFO reviews monthly — need to know if it made the agenda.",
    }}),
    prisma.crmTask.create({ data: {
      prospectId: p_ohiovalley.id,
      assignedToId: salesUserId,
      title: "Send discovery call agenda to Amanda Torres",
      taskType: "email",
      dueAt: daysAgo(1),
      priority: "normal",
      notes: "Agreed to send agenda before Thursday call.",
    }}),

    // 3 due today
    prisma.crmTask.create({ data: {
      opportunityId: opp4.id,
      assignedToId: salesUserId,
      title: "Review revised contract — Lakefront Property Services",
      taskType: "contract",
      dueAt: new Date(),
      priority: "high",
      notes: "James's legal team sent redlines. Review and respond by EOD.",
    }}),
    prisma.crmTask.create({ data: {
      opportunityId: opp2.id,
      assignedToId: salesUserId,
      title: "Send competitor comparison to Brian Callahan",
      taskType: "email",
      dueAt: new Date(),
      priority: "normal",
      notes: "Promised to send Relay vs. competitor one-pager after demo.",
    }}),
    prisma.crmTask.create({ data: {
      prospectId: p_meridian.id,
      assignedToId: salesUserId,
      title: "Trial check-in call — Meridian Industrial",
      taskType: "call",
      dueAt: new Date(),
      priority: "high",
      notes: "Phil mentioned techs might need more training on the mobile app. Set up 20-min call.",
    }}),

    // 3 upcoming
    prisma.crmTask.create({ data: {
      prospectId: p_allied.id,
      assignedToId: salesUserId,
      title: "Demo call with Tom Reeves — Allied Property Partners",
      taskType: "call",
      dueAt: daysFromNow(2),
      priority: "high",
      notes: "Full product walkthrough. Tom is decision maker. Emphasize vendor management.",
    }}),
    prisma.crmTask.create({ data: {
      prospectId: p_indiana.id,
      assignedToId: salesUserId,
      title: "Send pre-demo questionnaire to Gary Whitmore",
      taskType: "email",
      dueAt: daysFromNow(3),
      priority: "normal",
      notes: "Gary wants to bring IT and VP Ops to the demo — tailor deck to leadership audience.",
    }}),
    prisma.crmTask.create({ data: {
      opportunityId: opp1.id,
      assignedToId: salesUserId,
      title: "Schedule demo with Tom Hadley — Midwest Precision",
      taskType: "call",
      dueAt: daysFromNow(5),
      priority: "normal",
      notes: "Tom hasn't replied to last email. Try calling directly.",
    }}),
  ])

  // ── Follow-up reminders on emails ─────────────────────────────────────────
  // (set followUpDate on existing emails via updates — handled above via followUpDate fields)
  // Set 3 overdue and 4 due today on emails not yet done
  const overdueMails = await prisma.crmEmail.findMany({
    where: { sentBySalesUserId: salesUserId, direction: "sent", followUpDate: null },
    orderBy: { sentAt: "asc" },
    take: 7,
  })

  const updates = overdueMails.map((m, i) => prisma.crmEmail.update({
    where: { id: m.id },
    data: {
      followUpDate: i < 3 ? daysAgo(2 - i) : new Date(),
    },
  }))
  await Promise.all(updates)
}
