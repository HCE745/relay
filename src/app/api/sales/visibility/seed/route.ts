import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const DEFAULT_PROMPTS = [
  { promptText: "What is Relay software",                                              category: "brand"       },
  { promptText: "Relay operations management software review",                         category: "brand"       },
  { promptText: "getrelay.software",                                                   category: "brand"       },
  { promptText: "Best software for tracking operational issues in manufacturing",       category: "use_case"    },
  { promptText: "How to prevent maintenance requests from falling through the cracks",  category: "use_case"    },
  { promptText: "Software for managing recurring equipment problems",                   category: "use_case"    },
  { promptText: "Best plant manager software",                                          category: "use_case"    },
  { promptText: "How to track facility issues across multiple locations",               category: "use_case"    },
  { promptText: "Best manufacturing operations software",                               category: "industry"    },
  { promptText: "Warehouse operations management software",                             category: "industry"    },
  { promptText: "Property management issue tracking software",                          category: "industry"    },
  { promptText: "Restaurant operations management software",                            category: "industry"    },
  { promptText: "MaintainX alternatives",                                               category: "competitor"  },
  { promptText: "Best alternative to SafetyCulture",                                   category: "competitor"  },
  { promptText: "UpKeep competitors",                                                   category: "competitor"  },
  { promptText: "Limble CMMS alternatives",                                             category: "competitor"  },
  { promptText: "How to stop operational issues from being forgotten",                  category: "pain_point"  },
  { promptText: "Software for shift handoff communication in manufacturing",            category: "pain_point"  },
  { promptText: "How to track who is responsible for fixing problems at work",          category: "pain_point"  },
  { promptText: "Best tool for managing work orders and maintenance tasks",             category: "pain_point"  },
] as const

const DEFAULT_COMPETITORS = [
  { name: "MaintainX",            website: "https://www.getmaintainx.com" },
  { name: "SafetyCulture",        website: "https://safetyculture.com" },
  { name: "UpKeep",               website: "https://upkeep.com" },
  { name: "Limble",               website: "https://limblecmms.com" },
  { name: "Fiix",                 website: "https://fiixsoftware.com" },
  { name: "Maintenance Connection", website: "https://maintenanceconnection.com" },
  { name: "FMX",                  website: "https://gofmx.com" },
  { name: "Facilio",              website: "https://facilio.com" },
]

export async function POST() {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [existingPrompts, existingCompetitors] = await Promise.all([
    prisma.visibilityPrompt.count(),
    prisma.visibilityCompetitor.count(),
  ])

  const results: { prompts: number; competitors: number } = { prompts: 0, competitors: 0 }

  if (existingPrompts === 0) {
    await prisma.visibilityPrompt.createMany({
      data: DEFAULT_PROMPTS.map(p => ({
        promptText: p.promptText,
        category:   p.category as never,
        isActive:   true,
      })),
    })
    results.prompts = DEFAULT_PROMPTS.length
  }

  if (existingCompetitors === 0) {
    await prisma.visibilityCompetitor.createMany({ data: DEFAULT_COMPETITORS })
    results.competitors = DEFAULT_COMPETITORS.length
  }

  return NextResponse.json({ seeded: results })
}
