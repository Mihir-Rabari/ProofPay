import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActor, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const input = z.object({ email: z.string().trim().email(), role: z.enum(["FUNDER", "NGO_ADMIN", "FIELD_WORKER", "REVIEWER", "AUDITOR"]) });
type RouteContext = { params: Promise<{ organizationId: string }> };
export async function GET(request: NextRequest, { params }: RouteContext) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { organizationId } = await params;
  if (!requireRole(actor, organizationId, ["FUNDER", "NGO_ADMIN"])) return NextResponse.json({ error: "Only workspace admins can manage members." }, { status: 403 });
  const members = await prisma.membership.findMany({ where: { organizationId }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ members: members.map(m => ({ id: m.id, role: m.role, user: m.user, createdAt: m.createdAt })) });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { organizationId } = await params;
  if (!requireRole(actor, organizationId, ["FUNDER"])) return NextResponse.json({ error: "Only workspace funders can add members." }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide a valid email and workspace role." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user) return NextResponse.json({ error: "That user must create an account before you can add them." }, { status: 404 });
  const membership = await prisma.membership.upsert({ where: { userId_organizationId: { userId: user.id, organizationId } }, create: { userId: user.id, organizationId, role: parsed.data.role }, update: { role: parsed.data.role } });
  await prisma.auditLog.create({ data: { organizationId, actorId: actor.id, action: "MEMBER_ROLE_ASSIGNED", entityType: "Membership", entityId: membership.id, details: { userId: user.id, role: membership.role } } });
  return NextResponse.json({ membership: { id: membership.id, role: membership.role, user: { id: user.id, name: user.name, email: user.email } } }, { status: 201 });
}
