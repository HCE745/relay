// Attribution update endpoint — locked attributions require SuperAdmin.
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSalesSession } from "@/lib/sales-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const info = await getSalesSession();
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as {
    commissionOwnerId?: string;
    commissionRate?: number;
    attributionStatus?: string;
    attributionReason?: string;
    notes?: string;
    reason?: string; // required for locked-attribution changes
  };

  const attribution = await prisma.commissionAttribution.findUnique({ where: { id } });
  if (!attribution) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sensitiveFields = ["commissionOwnerId", "commissionRate", "attributionStatus"] as const;
  const changingSensitive = sensitiveFields.some(f => body[f] !== undefined);

  // Only SuperAdmin can touch locked attributions on sensitive fields
  if (attribution.isLocked && changingSensitive && !info.isSuperAdmin) {
    return NextResponse.json(
      { error: "This attribution is locked. Only a super admin can modify it." },
      { status: 403 }
    );
  }

  // Locked changes by SA must include a reason
  if (attribution.isLocked && info.isSuperAdmin && changingSensitive && !body.reason) {
    return NextResponse.json({ error: "A reason is required to modify a locked attribution." }, { status: 422 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.commissionOwnerId !== undefined && (info.isManager || info.isSuperAdmin))
    updateData.commissionOwnerId = body.commissionOwnerId;
  if (body.commissionRate !== undefined && (info.isManager || info.isSuperAdmin))
    updateData.commissionRate = body.commissionRate;
  if (body.attributionStatus !== undefined && (info.isManager || info.isSuperAdmin))
    updateData.attributionStatus = body.attributionStatus;
  if (body.attributionReason !== undefined && (info.isManager || info.isSuperAdmin))
    updateData.attributionReason = body.attributionReason;
  if (body.notes !== undefined)
    updateData.notes = body.notes;

  // SuperAdmin approval
  if (body.attributionStatus === "APPROVED" && info.isSuperAdmin) {
    updateData.attributionApprovedById = info.salesUserId;
    updateData.attributionApprovedAt   = new Date();
  }

  const updated = await prisma.commissionAttribution.update({ where: { id }, data: updateData });
  return NextResponse.json(updated);
}

// Manual lock/unlock endpoint
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const info = await getSalesSession();
  if (!info?.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as { action: "lock" | "unlock" };

  const updated = await prisma.commissionAttribution.update({
    where: { id },
    data: {
      isLocked:            body.action === "lock",
      attributionLockedAt: body.action === "lock" ? new Date() : null,
    },
  });
  return NextResponse.json(updated);
}
