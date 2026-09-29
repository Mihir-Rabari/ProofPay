import { NextRequest, NextResponse } from "next/server";
import { getActor, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ projectId: string }> };
export async function GET(request: NextRequest, { params }: RouteContext) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || !requireRole(actor, project.organizationId, ["FUNDER", "REVIEWER", "AUDITOR"])) return NextResponse.json({ error: "You do not have permission to read this audit trail." }, { status: 403 });
  const entries = await prisma.auditLog.findMany({ where: { organizationId: project.organizationId }, orderBy: { createdAt: "desc" }, take: 500 });
  return NextResponse.json({ entries });
}
