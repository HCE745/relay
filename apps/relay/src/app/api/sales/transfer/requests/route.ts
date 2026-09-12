export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSalesSession } from "@/lib/sales-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const info = await getSalesSession();
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (info.isRep) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";

  const requests = await prisma.crmTransferRequest.findMany({
    where: { status },
    include: {
      requestedBy: { select: { id: true, name: true } },
      toUser: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(requests);
}
