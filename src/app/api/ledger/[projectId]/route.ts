import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ projectId: string }> };
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { projectId } = await params;
  const project = await prisma.project.findFirst({ where: { id: projectId, isPublic: true }, select: { id: true, name: true, description: true, location: true, milestones: { where: { verdict: "VERIFIED" }, include: { assets: { select: { id: true, thumbnailUrl: true, sha256: true, capturedAt: true, caption: true, trustScore: true } } } } } });
  if (!project) return NextResponse.json({ error: "This project has no public ledger." }, { status: 404 });
  const entries = await prisma.ledgerEntry.findMany({ where: { projectId }, orderBy: { createdAt: "asc" }, select: { id: true, type: true, amount: true, createdAt: true, milestoneId: true } });
  return NextResponse.json({ project, entries });
}
