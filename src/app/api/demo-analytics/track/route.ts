import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createHash } from "crypto"

export const dynamic = "force-dynamic"

function fingerprint(req: NextRequest): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown"
  const ua = req.headers.get("user-agent") ?? ""
  return createHash("sha256").update(`${ip}:${ua}`).digest("hex").slice(0, 32)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      page?:               string
      industrySelected?:   string
      packageSelected?:    string
      tourStepsCompleted?: number[]
      timeOnEachStep?:     Record<string, number>
      clickedStartTrial?:  boolean
      clickedBookDemo?:    boolean
      clickedExplore?:     boolean
      sessionEnd?:         boolean
      convertedToSignup?:  boolean
    }

    const fp  = fingerprint(req)
    const page = body.page ?? "demo"

    // Find existing session from today or create new one
    const existing = await prisma.demoAnalytics.findFirst({
      where: {
        fingerprint: fp,
        page,
        createdAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) }, // within 4h
      },
      orderBy: { createdAt: "desc" },
    })

    const data = {
      fingerprint:         fp,
      page,
      industrySelected:    body.industrySelected,
      packageSelected:     body.packageSelected,
      tourStepsCompleted:  body.tourStepsCompleted ?? undefined,
      timeOnEachStep:      body.timeOnEachStep     ?? undefined,
      clickedStartTrial:   body.clickedStartTrial  ?? undefined,
      clickedBookDemo:     body.clickedBookDemo     ?? undefined,
      clickedExplore:      body.clickedExplore      ?? undefined,
      sessionEnd:          body.sessionEnd ? new Date() : undefined,
      convertedToSignup:   body.convertedToSignup  ?? undefined,
    }

    if (existing) {
      await prisma.demoAnalytics.update({
        where: { id: existing.id },
        data: {
          ...(data.industrySelected   != null && { industrySelected:  data.industrySelected }),
          ...(data.packageSelected    != null && { packageSelected:   data.packageSelected }),
          ...(data.tourStepsCompleted != null && { tourStepsCompleted: data.tourStepsCompleted }),
          ...(data.timeOnEachStep     != null && { timeOnEachStep:    data.timeOnEachStep }),
          ...(data.clickedStartTrial  != null && { clickedStartTrial: data.clickedStartTrial }),
          ...(data.clickedBookDemo    != null && { clickedBookDemo:   data.clickedBookDemo }),
          ...(data.clickedExplore     != null && { clickedExplore:    data.clickedExplore }),
          ...(data.sessionEnd         != null && { sessionEnd:        data.sessionEnd }),
          ...(data.convertedToSignup  != null && { convertedToSignup: data.convertedToSignup }),
        },
      })
    } else {
      await prisma.demoAnalytics.create({
        data: {
          fingerprint:        fp,
          page,
          industrySelected:   body.industrySelected,
          packageSelected:    body.packageSelected,
          tourStepsCompleted: body.tourStepsCompleted ?? [],
          timeOnEachStep:     body.timeOnEachStep ?? {},
          clickedStartTrial:  body.clickedStartTrial  ?? false,
          clickedBookDemo:    body.clickedBookDemo     ?? false,
          clickedExplore:     body.clickedExplore      ?? false,
          sessionEnd:         body.sessionEnd ? new Date() : undefined,
          convertedToSignup:  body.convertedToSignup  ?? false,
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
