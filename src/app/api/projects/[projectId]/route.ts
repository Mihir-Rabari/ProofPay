import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActor, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ projectId: string }> };
const input = z.object({ isPublic: z.boolean().optional(), latitude: z.number().min(-90).max(90).nullable().optional(), longitude: z.number().min(-180).max(180).nullable().optional(), geofenceRadiusM: z.number().min(30).max(10000).optional() });
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || !requireRole(actor, project.organizationId, ["FUNDER"])) return NextResponse.json({ error: "Only workspace funders can change project settings." }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !Object.keys(parsed.data ?? {}).length) return NextResponse.json({ error: "Provide project settings to update." }, { status: 400 });
  const latitude = parsed.data.latitude === undefined ? project.latitude : parsed.data.latitude;
  const longitude = parsed.data.longitude === undefined ? project.longitude : parsed.data.longitude;
  if ((latitude === null) !== (longitude === null)) return NextResponse.json({ error: "Latitude and longitude must be updated together." }, { status: 400 });
  const updated = await prisma.project.update({ where: { id: projectId }, data: parsed.data });
  await prisma.auditLog.create({ data: { organizationId: project.organizationId, actorId: actor.id, action: "PROJECT_SETTINGS_UPDATED", entityType: "Project", entityId: projectId, details: parsed.data } });
  return NextResponse.json({ project: updated });
}
