import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActor, requireRole } from "@/lib/auth";

const projectInput = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().min(8).max(2000),
  location: z.string().trim().min(2).max(160),
  budget: z.number().int().positive(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  geofenceRadiusM: z.number().min(30).max(10000).optional(),
}).refine(data => (data.latitude == null) === (data.longitude == null), { message: "Latitude and longitude must be supplied together.", path: ["latitude"] });

export async function GET(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const organizationIds = actor.memberships.map(m => m.organizationId);
  const projects = await prisma.project.findMany({ where: { organizationId: { in: organizationIds } }, include: { milestones: true, _count: { select: { assets: true } } }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const parsed = projectInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid project details", issues: parsed.error.flatten() }, { status: 400 });
  const organizationId = request.nextUrl.searchParams.get("organizationId") ?? actor.memberships[0]?.organizationId;
  if (!organizationId || !requireRole(actor, organizationId, ["FUNDER", "NGO_ADMIN"])) return NextResponse.json({ error: "Only workspace funders and NGO admins can create projects." }, { status: 403 });
  const project = await prisma.project.create({ data: { ...parsed.data, organizationId } });
  await prisma.auditLog.create({ data: { organizationId, actorId: actor.id, action: "PROJECT_CREATED", entityType: "Project", entityId: project.id, details: { name: project.name } } });
  return NextResponse.json({ project }, { status: 201 });
}

