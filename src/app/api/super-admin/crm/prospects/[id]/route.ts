import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

type RouteCtx = { params: Promise<{ id: string }> }

async function requireSA() {
  const session = await getSession()
  if (!session?.superAdmin) return null
  return session
}

export async function GET(
  _req: NextRequest,
  { params }: RouteCtx
) {
  if (!await requireSA()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const prospect = await prisma.prospect.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { createdAt: "asc" } },
      notes:    { orderBy: { createdAt: "desc" } },
    },
  })

  if (!prospect) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ prospect })
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteCtx
) {
  if (!await requireSA()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const body = await req.json() as {
    companyName?:           string
    website?:               string | null
    industry?:              string | null
    employeeCountMin?:      number | null
    employeeCountMax?:      number | null
    locationsCount?:        number | null
    headquartersCity?:      string | null
    headquartersState?:     string | null
    headquartersCountry?:   string | null
    linkedinUrl?:           string | null
    aiFitScore?:            number | null
    researchSummary?:       string | null
    operationalPainPoints?: string | null
    relayFitReasons?:       string | null
    suggestedDemoEmphasis?: string | null
    suggestedOutreachAngle?: string | null
    decisionMakerTitles?:   string[]
    confidenceScore?:       number | null
    currentCrmStatus?:      string
    assignedToName?:        string | null
    lastOutreachDate?:      string | null
    lastReplyDate?:         string | null
    pipelineStage?:         string | null
  }

  const data: Record<string, unknown> = { updatedAt: new Date() }

  if (body.companyName           !== undefined) data.companyName           = body.companyName
  if (body.website               !== undefined) data.website               = body.website
  if (body.industry              !== undefined) data.industry              = body.industry
  if (body.employeeCountMin      !== undefined) data.employeeCountMin      = body.employeeCountMin
  if (body.employeeCountMax      !== undefined) data.employeeCountMax      = body.employeeCountMax
  if (body.locationsCount        !== undefined) data.locationsCount        = body.locationsCount
  if (body.headquartersCity      !== undefined) data.headquartersCity      = body.headquartersCity
  if (body.headquartersState     !== undefined) data.headquartersState     = body.headquartersState
  if (body.headquartersCountry   !== undefined) data.headquartersCountry   = body.headquartersCountry
  if (body.linkedinUrl           !== undefined) data.linkedinUrl           = body.linkedinUrl
  if (body.aiFitScore            !== undefined) data.aiFitScore            = body.aiFitScore
  if (body.researchSummary       !== undefined) data.researchSummary       = body.researchSummary
  if (body.operationalPainPoints !== undefined) data.operationalPainPoints = body.operationalPainPoints
  if (body.relayFitReasons       !== undefined) data.relayFitReasons       = body.relayFitReasons
  if (body.suggestedDemoEmphasis !== undefined) data.suggestedDemoEmphasis = body.suggestedDemoEmphasis
  if (body.suggestedOutreachAngle !== undefined) data.suggestedOutreachAngle = body.suggestedOutreachAngle
  if (body.decisionMakerTitles   !== undefined) data.decisionMakerTitles   = body.decisionMakerTitles
  if (body.confidenceScore       !== undefined) data.confidenceScore       = body.confidenceScore
  if (body.currentCrmStatus      !== undefined) data.currentCrmStatus      = body.currentCrmStatus
  if (body.assignedToName        !== undefined) data.assignedToName        = body.assignedToName
  if (body.lastOutreachDate      !== undefined) data.lastOutreachDate      = body.lastOutreachDate ? new Date(body.lastOutreachDate) : null
  if (body.lastReplyDate         !== undefined) data.lastReplyDate         = body.lastReplyDate ? new Date(body.lastReplyDate) : null
  if (body.pipelineStage         !== undefined) data.pipelineStage         = body.pipelineStage

  const prospect = await prisma.prospect.update({ where: { id }, data })

  return NextResponse.json({ prospect })
}

export async function DELETE(
  _req: NextRequest,
  { params }: RouteCtx
) {
  if (!await requireSA()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  await prisma.prospect.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}

export async function POST(
  req: NextRequest,
  { params }: RouteCtx
) {
  if (!await requireSA()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const body = await req.json() as {
    action: "add_contact" | "add_note" | "delete_contact" | "delete_note"
    // add_contact
    contact?: {
      name:            string
      title?:          string
      email?:          string
      emailSource?:    string
      emailConfidence?: string
      linkedinUrl?:    string
      notes?:          string
    }
    // add_note
    noteText?:  string
    createdBy?: string
    // delete_contact / delete_note
    contactId?: string
    noteId?:    string
  }

  switch (body.action) {
    case "add_contact": {
      if (!body.contact) {
        return NextResponse.json({ error: "contact is required" }, { status: 400 })
      }
      const contact = await prisma.prospectContact.create({
        data: {
          prospectId:      id,
          name:            body.contact.name,
          title:           body.contact.title            ?? null,
          email:           body.contact.email            ?? null,
          emailSource:     body.contact.emailSource      ?? null,
          emailConfidence: (body.contact.emailConfidence as never) ?? null,
          linkedinUrl:     body.contact.linkedinUrl      ?? null,
          notes:           body.contact.notes            ?? null,
        },
      })
      return NextResponse.json({ contact })
    }

    case "add_note": {
      if (!body.noteText) {
        return NextResponse.json({ error: "noteText is required" }, { status: 400 })
      }
      const note = await prisma.prospectNote.create({
        data: {
          prospectId: id,
          noteText:   body.noteText,
          createdBy:  body.createdBy ?? null,
        },
      })
      return NextResponse.json({ note })
    }

    case "delete_contact": {
      if (!body.contactId) {
        return NextResponse.json({ error: "contactId is required" }, { status: 400 })
      }
      await prisma.prospectContact.delete({ where: { id: body.contactId } })
      return NextResponse.json({ ok: true })
    }

    case "delete_note": {
      if (!body.noteId) {
        return NextResponse.json({ error: "noteId is required" }, { status: 400 })
      }
      await prisma.prospectNote.delete({ where: { id: body.noteId } })
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }
}
