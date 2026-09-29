import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActor, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const input = z.object({ amount: z.number().int().positive(), idempotencyKey: z.string().trim().min(8).max(120) });
type RouteContext = { params: Promise<{ projectId: string }> };
export async function POST(request: NextRequest, { params }: RouteContext) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || !requireRole(actor, project.organizationId, ["FUNDER"])) return NextResponse.json({ error: "Only a project funder can fund simulated escrow." }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide a whole-rupee amount and idempotency key." }, { status: 400 });
  const key = `fund:${projectId}:${parsed.data.idempotencyKey}`;
  const existing = await prisma.ledgerEntry.findUnique({ where: { idempotencyKey: key } });
  if (existing) return existing.amount === parsed.data.amount ? NextResponse.json({ entry: existing, replayed: true }) : NextResponse.json({ error: "Idempotency key was already used with another amount." }, { status: 409 });
  try {
    const funded = await prisma.$transaction(async tx => {
      const current = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
      if (current.funded + parsed.data.amount > current.budget) throw new Error("BUDGET_EXCEEDED");
      const entry = await tx.ledgerEntry.create({ data: { projectId, type: "FUND", amount: parsed.data.amount, debitAccount: `funder:${current.organizationId}`, creditAccount: "escrow", idempotencyKey: key } });
      const updated = await tx.project.update({ where: { id: projectId }, data: { funded: { increment: parsed.data.amount } } });
      await tx.auditLog.create({ data: { organizationId: project.organizationId, actorId: actor.id, action: "ESCROW_FUNDED_SIMULATED", entityType: "Project", entityId: projectId, details: { amount: parsed.data.amount, idempotencyKey: key } } });
      return { entry, project: updated };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(funded, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "BUDGET_EXCEEDED") return NextResponse.json({ error: "Funding would exceed the project budget." }, { status: 409 });
    if ((error as { code?: string })?.code === "P2034") return NextResponse.json({ error: "Another escrow update committed first. Retry with the same idempotency key." }, { status: 409 });
    if ((error as { code?: string })?.code === "P2002") {
      const replay = await prisma.ledgerEntry.findUnique({ where: { idempotencyKey: key } });
      if (replay?.amount === parsed.data.amount) return NextResponse.json({ entry: replay, replayed: true });
      return NextResponse.json({ error: "Idempotency key was already used with another amount." }, { status: 409 });
    }
    throw error;
  }
}
