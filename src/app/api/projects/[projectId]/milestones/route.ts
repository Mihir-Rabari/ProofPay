import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActor, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const input = z.object({ title: z.string().trim().min(3).max(160), criteria: z.string().trim().min(10).max(3000), amount: z.number().int().positive(), dueAt: z.string().datetime(), minTrust: z.number().min(0.5).max(1).default(0.8) });
type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || !requireRole(actor, project.organizationId, ["FUNDER", "NGO_ADMIN", "FIELD_WORKER", "REVIEWER", "AUDITOR"])) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const milestones = await prisma.milestone.findMany({ where: { projectId }, include: { _count: { select: { assets: true } } }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ milestones });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || !requireRole(actor, project.organizationId, ["FUNDER", "NGO_ADMIN"])) return NextResponse.json({ error: "Only funders and NGO admins can add milestones." }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid milestone details.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const milestone = await prisma.$transaction(async tx => {
      const entries = await tx.ledgerEntry.findMany({ where: { projectId, type: { in: ["FUND", "HOLD"] } }, select: { type: true, amount: true } });
      const available = entries.reduce((balance, entry) => balance + (entry.type === "FUND" ? entry.amount : -entry.amount), 0);
      if (available < parsed.data.amount) throw new Error("INSUFFICIENT_ESCROW");
      const created = await tx.milestone.create({ data: { projectId, ...parsed.data, dueAt: new Date(parsed.data.dueAt) } });
      await tx.ledgerEntry.create({ data: { projectId, milestoneId: created.id, type: "HOLD", amount: created.amount, debitAccount: "escrow", creditAccount: `milestone:${created.id}`, idempotencyKey: `hold:${created.id}` } });
      await tx.auditLog.create({ data: { organizationId: project.organizationId, actorId: actor.id, action: "MILESTONE_CREATED_AND_HELD", entityType: "Milestone", entityId: created.id, details: { amount: created.amount } } });
      return created;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ milestone }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_ESCROW") return NextResponse.json({ error: "Fund the project before allocating this milestone. Available simulated escrow is too low." }, { status: 409 });
    if ((error as { code?: string })?.code === "P2034") return NextResponse.json({ error: "Escrow changed while you allocated this milestone. Refresh and retry." }, { status: 409 });
    throw error;
  }
}
