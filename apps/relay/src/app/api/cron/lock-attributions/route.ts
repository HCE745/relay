// Cron: lock CommissionAttributions whose 48-hour window has passed.
// Called by Vercel Cron or manually. Protected by CRON_SECRET.
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const result = await prisma.commissionAttribution.updateMany({
    where: {
      isLocked: false,
      attributionLockedAt: { lte: now },
    },
    data: { isLocked: true },
  });

  return NextResponse.json({ ok: true, locked: result.count });
}
