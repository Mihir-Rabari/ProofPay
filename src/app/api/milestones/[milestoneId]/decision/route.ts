import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActor, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const input = z.object({ verdict: z.enum(["VERIFIED", "NEEDS_REVIEW", "REJECTED"]), reason: z.string().trim().min(12).max(2000) });
type RouteContext = { params: Promise<{ milestoneId: string }> };
export async function POST(request: NextRequest, { params }: RouteContext) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { milestoneId } = await params;
  const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId }, include: { project: true, assets: true } });
  if (!milestone || !requireRole(actor, milestone.project.organizationId, ["REVIEWER"])) return NextResponse.json({ error: "A workspace reviewer must make this decision." }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide a verdict and an explanation for the audit trail." }, { status: 400 });
  if (milestone.releasedAt && parsed.data.verdict !== "VERIFIED") return NextResponse.json({ error: "A released milestone cannot be reversed. Open a dispute record instead." }, { status: 409 });
  if (parsed.data.verdict === "VERIFIED" && milestone.assets.length === 0) return NextResponse.json({ error: "A milestone cannot be verified before it has linked evidence." }, { status: 409 });
  const trustScore = milestone.assets.length ? milestone.assets.reduce((sum, asset) => sum + asset.trustScore, 0) / milestone.assets.length : 0;
  try {
    const result = await prisma.$transaction(async tx => {
      const current = await tx.milestone.findUniqueOrThrow({ where: { id: milestoneId } });
      const updated = await tx.milestone.update({ where: { id: milestoneId }, data: { verdict: parsed.data.verdict, trustScore } });
      if (parsed.data.verdict === "VERIFIED") await tx.asset.updateMany({ where: { milestoneId }, data: { status: "VERIFIED" } });
      if (parsed.data.verdict === "REJECTED") await tx.asset.updateMany({ where: { milestoneId }, data: { status: "REJECTED" } });
      let release = null;
      if (parsed.data.verdict === "VERIFIED" && !current.releasedAt) {
        release = await tx.ledgerEntry.create({ data: { projectId: current.projectId, milestoneId, type: "RELEASE", amount: current.amount, debitAccount: `milestone:${milestoneId}`, creditAccount: `ngo:${milestone.project.organizationId}`, idempotencyKey: `release:${milestoneId}` } });
        await tx.milestone.update({ where: { id: milestoneId }, data: { releasedAt: new Date() } });
      }
      await tx.auditLog.create({ data: { organizationId: milestone.project.organizationId, actorId: actor.id, action: `MILESTONE_${parsed.data.verdict}`, entityType: "Milestone", entityId: milestoneId, details: { reason: parsed.data.reason, averageTrust: trustScore, evidenceCount: milestone.assets.length, released: !!release } } });
      return { milestone: updated, release };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(result);
  } catch (error) {
    if ((error as { code?: string })?.code === "P2034") return NextResponse.json({ error: "Another decision committed first. Refresh this milestone before retrying." }, { status: 409 });
    if ((error as { code?: string })?.code === "P2002") {
      const latest = await prisma.milestone.findUnique({ where: { id: milestoneId } });
      return NextResponse.json({ milestone: latest, replayed: true });
    }
    throw error;
  }
}
