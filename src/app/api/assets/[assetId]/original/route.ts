import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getActor, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ assetId: string }> };
const localPublicId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(request: NextRequest, { params }: RouteContext) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Sign in to access original evidence." }, { status: 401 });
  const { assetId } = await params;
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, include: { project: true } });
  if (!asset || !requireRole(actor, asset.project.organizationId, ["FUNDER", "NGO_ADMIN", "FIELD_WORKER", "REVIEWER", "AUDITOR"])) return NextResponse.json({ error: "Evidence not found." }, { status: 404 });
  if (asset.storageProvider === "CLOUDINARY") return NextResponse.redirect(asset.secureUrl, { status: 302 });
  if (!localPublicId.test(asset.publicId)) return NextResponse.json({ error: "Original evidence is unavailable." }, { status: 404 });
  const details = asset.analysis && typeof asset.analysis === "object" ? asset.analysis as Record<string, unknown> : {};
  const mimeType = details.mimeType === "image/png" || details.mimeType === "image/webp" ? details.mimeType : "image/jpeg";
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const bytes = await readFile(join(process.cwd(), ".proofpay", "originals", `${asset.publicId}.${extension}`)).catch(() => null);
  if (!bytes) return NextResponse.json({ error: "Original evidence file is missing." }, { status: 404 });
  return new NextResponse(bytes, { headers: { "content-type": mimeType, "content-disposition": "inline", "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" } });
}
