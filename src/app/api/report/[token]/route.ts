import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { autoRouteIssue } from "@/lib/routing"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const qrCode = await prisma.qrCode.findUnique({
    where: { token },
    select: {
      id:                 true,
      organizationId:     true,
      isActive:           true,
      name:               true,
      area:               true,
      defaultCategory:    true,
      locationId:         true,
      departmentId:       true,
      assetId:            true,
      collectContactInfo: true,
      requireContactInfo: true,
      requirePhoto:       true,
      reportingMode:      true,
      routingMode:        true,
      assignedToId:       true,
      assignedTo: {
        select: { id: true, isActive: true },
      },
    },
  })

  if (!qrCode || !qrCode.isActive) {
    return NextResponse.json({ error: "This reporting link is not active" }, { status: 404 })
  }

  let title: string | null = null
  let description: string | null = null
  let reporterName: string | null = null
  let reporterEmail: string | null = null
  let reporterPhone: string | null = null
  let photoUrls: string[] = []
  let photoAttached = false
  let overrideCategory: string | null = null

  const contentType = req.headers.get("content-type") ?? ""

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData()
    title        = (formData.get("title")       as string | null)?.trim() ?? null
    description  = (formData.get("description") as string | null)?.trim() ?? null
    reporterName  = (formData.get("reporterName")  as string | null)?.trim() || null
    reporterEmail = (formData.get("reporterEmail") as string | null)?.trim() || null
    reporterPhone = (formData.get("reporterPhone") as string | null)?.trim() || null

    const photoFile = formData.get("photo")
    if (photoFile && typeof photoFile !== "string" && (photoFile as File).size > 0) {
      photoAttached = true
      // File storage not wired — photo received but not persisted to URL.
      // photoUrls stays empty; photoAttached=true satisfies requirePhoto.
    }
    const submittedCategory = (formData.get("category") as string | null)?.trim() || null
    if (submittedCategory) overrideCategory = submittedCategory
  } else {
    const body = await req.json() as {
      title?: string
      description?: string
      reporterName?: string
      reporterEmail?: string
      reporterPhone?: string
      photoUrls?: string[]
      category?: string
    }
    title        = body.title?.trim() ?? null
    description  = body.description?.trim() ?? null
    reporterName  = body.reporterName?.trim()  || null
    reporterEmail = body.reporterEmail?.trim() || null
    reporterPhone = body.reporterPhone?.trim() || null
    photoUrls     = body.photoUrls ?? []
    photoAttached = photoUrls.length > 0
    if (body.category?.trim()) overrideCategory = body.category.trim()
  }

  if (!title)       return NextResponse.json({ error: "Title is required" },       { status: 400 })
  if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 })

  if (qrCode.requireContactInfo) {
    if (!reporterName)  return NextResponse.json({ error: "Your name is required" },  { status: 400 })
    if (!reporterEmail) return NextResponse.json({ error: "Your email is required" }, { status: 400 })
  }

  if (qrCode.requirePhoto && !photoAttached) {
    return NextResponse.json({ error: "A photo is required" }, { status: 400 })
  }

  const submission = await prisma.qrCodeSubmission.create({
    data: {
      qrCodeId:       qrCode.id,
      organizationId: qrCode.organizationId,
      title,
      description,
      reporterName,
      reporterEmail,
      reporterPhone,
      photoUrls,
      status: "PENDING",
    },
  })

  // Create an Issue so the submission appears in the org's queue
  try {
    const orgAdmin = await prisma.user.findFirst({
      where: { organizationId: qrCode.organizationId, role: "ADMIN", isActive: true },
      select: { id: true },
    })

    if (orgAdmin) {
      const category = overrideCategory ?? qrCode.defaultCategory ?? "GENERAL"

      // Determine assignee: MANUAL routing takes priority if assigned person is active
      const manualAssigneeId =
        qrCode.routingMode === "MANUAL" && qrCode.assignedTo?.isActive
          ? qrCode.assignedToId
          : null

      let assignedUserId: string | null = null
      let notificationMessage: string

      if (manualAssigneeId) {
        assignedUserId    = manualAssigneeId
        notificationMessage = `Assigned via QR code configuration: ${title}`
      } else {
        const routing = await autoRouteIssue({
          organizationId: qrCode.organizationId,
          category,
          priority:       "MEDIUM",
          locationId:     qrCode.locationId   ?? null,
          departmentId:   qrCode.departmentId ?? null,
          assetId:        qrCode.assetId      ?? null,
        })
        assignedUserId    = routing.userId
        notificationMessage = routing.ruleName
          ? `Auto-routed via "${routing.ruleName}": ${title}`
          : `External report submitted via QR code: ${title}`
      }

      // Build description: original text + reporter info + QR code source
      const descParts: string[] = [description]
      if (reporterName || reporterEmail || reporterPhone) {
        descParts.push(
          `Reporter: ${[reporterName, reporterEmail, reporterPhone].filter(Boolean).join(" · ")}`
        )
      }
      descParts.push(
        `Submitted via QR code: ${qrCode.name}${qrCode.area ? ` — ${qrCode.area}` : ""}`
      )
      const issueDescription = descParts.join("\n\n")

      const issue = await prisma.issue.create({
        data: {
          title,
          description:    issueDescription,
          priority:       "MEDIUM",
          category,
          status:         "OPEN",
          organizationId: qrCode.organizationId,
          reportedById:   orgAdmin.id,
          locationId:     qrCode.locationId   ?? null,
          departmentId:   qrCode.departmentId ?? null,
          assetId:        qrCode.assetId      ?? null,
          assignedToId:   assignedUserId,
          areaDetail:     qrCode.area ?? null,
        },
        select: { id: true },
      })

      await prisma.qrCodeSubmission.update({
        where: { id: submission.id },
        data:  { issueId: issue.id, status: "ROUTED" },
      })

      await prisma.issueHistory.create({
        data: {
          issueId:     issue.id,
          field:       "status",
          oldValue:    null,
          newValue:    "OPEN",
          changedById: orgAdmin.id,
        },
      })

      if (assignedUserId) {
        await prisma.notification.create({
          data: {
            userId:         assignedUserId,
            organizationId: qrCode.organizationId,
            issueId:        issue.id,
            type:           "ISSUE_ASSIGNED",
            title:          "New QR Code Submission",
            message:        notificationMessage,
          },
        })
      }
    }
  } catch (err) {
    console.error("[QR Submission] Failed to create issue:", err)
    // Submission is already saved — don't fail the public-facing request
  }

  const referenceNumber = submission.id.slice(-8).toUpperCase()
  return NextResponse.json({ ok: true, referenceNumber })
}
