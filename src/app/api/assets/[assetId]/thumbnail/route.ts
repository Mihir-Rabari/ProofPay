import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getActor, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ assetId: string }> };
const localPublicId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { assetId } = await params;
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, include: { project: true, milestone: true } });
  if (!asset || !asset.milestone) return NextResponse.json({ error: "Evidence not found." }, { status: 404 });
  const publicAccess = asset.project.isPublic && asset.milestone.verdict === "VERIFIED";
  if (!publicAccess) {
    const actor = await getActor(request);
    if (!actor || !requireRole(actor, asset.project.organizationId, ["FUNDER", "NGO_ADMIN", "FIELD_WORKER", "REVIEWER", "AUDITOR"])) return NextResponse.json({ error: "Evidence not found." }, { status: 404 });
  }
  if (asset.storageProvider === "CLOUDINARY") return NextResponse.redirect(asset.thumbnailUrl, { status: 302 });
  if (!localPublicId.test(asset.publicId)) return NextResponse.json({ error: "Evidence preview is unavailable." }, { status: 404 });
  const bytes = await readFile(join(process.cwd(), ".proofpay", "previews", `${asset.publicId}.jpg`)).catch(() => null);
  if (!bytes) return NextResponse.json({ error: "Evidence preview file is missing." }, { status: 404 });
  return new NextResponse(bytes, { headers: { "content-type": "image/jpeg", "cache-control": publicAccess ? "public, max-age=300" : "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" } });
}
