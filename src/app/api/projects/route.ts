import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const projectInput = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().min(8).max(2000),
  location: z.string().trim().min(2).max(160),
  budget: z.number().int().positive(),
});

export async function GET() {
  const projects = await prisma.project.findMany({ include: { milestones: true, _count: { select: { assets: true } } }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const parsed = projectInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid project details", issues: parsed.error.flatten() }, { status: 400 });
  const project = await prisma.project.create({ data: parsed.data });
  return NextResponse.json({ project }, { status: 201 });
}
