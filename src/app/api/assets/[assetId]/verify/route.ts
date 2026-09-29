import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getActor, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/verification";

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
  let bytes: Buffer;
  if (asset.storageProvider === "LOCAL") {
    if (!localPublicId.test(asset.publicId)) return NextResponse.json({ error: "Evidence cannot be verified." }, { status: 404 });
    const details = asset.analysis && typeof asset.analysis === "object" ? asset.analysis as Record<string, unknown> : {};
    const extension = details.mimeType === "image/png" ? "png" : details.mimeType === "image/webp" ? "webp" : "jpg";
    const source = await readFile(join(process.cwd(), ".proofpay", "originals", `${asset.publicId}.${extension}`)).catch(() => null);
    if (!source) return NextResponse.json({ error: "The original file is missing from private storage." }, { status: 404 });
    bytes = source;
  } else {
    const originalUrl = new URL(asset.secureUrl);
    if (originalUrl.protocol !== "https:" || originalUrl.hostname !== "res.cloudinary.com") return NextResponse.json({ error: "Stored media URL failed the host integrity check." }, { status: 409 });
    const response = await fetch(originalUrl, { signal: AbortSignal.timeout(20000), redirect: "error" });
    if (!response.ok) return NextResponse.json({ error: "Cloudinary could not return the authenticated original." }, { status: 502 });
    const size = Number(response.headers.get("content-length") ?? 0);
    if (size > 12 * 1024 * 1024) return NextResponse.json({ error: "Original exceeds the configured verification size limit." }, { status: 413 });
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > 12 * 1024 * 1024) return NextResponse.json({ error: "Original exceeds the configured verification size limit." }, { status: 413 });
  }
  const recomputed = Buffer.from(sha256(bytes), "hex"), expected = Buffer.from(asset.sha256, "hex");
  const intact = recomputed.length === expected.length && timingSafeEqual(recomputed, expected);
  return NextResponse.json({ assetId: asset.id, algorithm: "SHA-256", recordedHash: asset.sha256, recomputedHash: recomputed.toString("hex"), intact, checkedAt: new Date().toISOString() }, { status: intact ? 200 : 409, headers: { "cache-control": "no-store" } });
}
