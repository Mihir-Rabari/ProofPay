import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import { getActor, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeWithGemini, captureMetadata, imageFingerprint, scoreChecks, sha256 } from "@/lib/verification";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BYTES = 12 * 1024 * 1024;
const supported = new Set(["image/jpeg", "image/png", "image/webp"]);
type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || !requireRole(actor, project.organizationId, ["FUNDER", "NGO_ADMIN", "FIELD_WORKER", "REVIEWER", "AUDITOR"])) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const assets = await prisma.asset.findMany({ where: { projectId }, include: { milestone: { select: { id: true, title: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  const milestones = await prisma.milestone.findMany({ where: { projectId }, select: { id: true, title: true }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ assets: assets.map(asset => ({ ...asset, secureUrl: undefined, thumbnailUrl: `/api/assets/${asset.id}/thumbnail` })), milestones });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || !requireRole(actor, project.organizationId, ["FUNDER", "NGO_ADMIN", "FIELD_WORKER"])) return NextResponse.json({ error: "You do not have permission to submit evidence to this project." }, { status: 403 });
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME, apiKey = process.env.CLOUDINARY_API_KEY, apiSecret = process.env.CLOUDINARY_API_SECRET;
  const hasAnyCloudinary = !!(cloudName || apiKey || apiSecret);
  const cloudReady = !!(cloudName && apiKey && apiSecret);
  if (hasAnyCloudinary && !cloudReady) return NextResponse.json({ error: "Cloudinary configuration is incomplete. Set cloud name, API key, and API secret together, or clear all three to use private local storage." }, { status: 503 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BYTES + 1024 * 1024) return NextResponse.json({ error: "Upload is too large. Images must be smaller than 12 MB." }, { status: 413 });
  const form = await request.formData();
  const file = form.get("file"), milestoneValue = form.get("milestoneId");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  if (typeof milestoneValue !== "string") return NextResponse.json({ error: "Select a milestone before uploading." }, { status: 400 });
  const milestoneId = milestoneValue;
  if (!supported.has(file.type)) return NextResponse.json({ error: "Upload a JPEG, PNG, or WebP image. Other formats are not supported yet." }, { status: 415 });
  if (!file.size || file.size > MAX_BYTES) return NextResponse.json({ error: "Images must be smaller than 12 MB." }, { status: 413 });
  const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, projectId } });
  if (!milestone) return NextResponse.json({ error: "Select a milestone in this project before uploading." }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const fingerprint = await imageFingerprint(bytes);
  const metadata = await captureMetadata(bytes);
  let publicId: string = randomUUID();
  let cloudinaryPublicId: string | null = null;
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  const localRoot = join(process.cwd(), ".proofpay");
  const localOriginal = join(localRoot, "originals", `${publicId}.${extension}`);
  const localThumbnail = join(localRoot, "previews", `${publicId}.jpg`);
  let version = 1, width: number | null = null, height: number | null = null;
  let originalUrl = "", thumbnailUrl = "", storageProvider: "LOCAL" | "CLOUDINARY" = "LOCAL";
  if (cloudReady) {
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    const uploaded = await new Promise<{ public_id: string; version: number; width?: number; height?: number }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: `proofpay/${projectId}/${milestoneId}`, resource_type: "image", type: "authenticated", image_metadata: true, unique_filename: true, context: { milestone_id: milestoneId, uploader_id: actor.id } }, (error, result) => {
        if (error || !result) reject(error ?? new Error("Cloudinary returned an empty upload.")); else resolve(result);
      });
      stream.end(bytes);
    }).catch(error => { console.error("Cloudinary upload failed", error); throw new Error("Cloudinary could not store this original. Check credentials and account limits."); });
    publicId = uploaded.public_id;
    cloudinaryPublicId = uploaded.public_id;
    storageProvider = "CLOUDINARY";
    version = uploaded.version;
    width = uploaded.width ?? null; height = uploaded.height ?? null;
    originalUrl = cloudinary.url(uploaded.public_id, { secure: true, type: "authenticated", version, sign_url: true, resource_type: "image" });
    thumbnailUrl = cloudinary.url(uploaded.public_id, { secure: true, type: "authenticated", version, sign_url: true, resource_type: "image", transformation: [{ width: 1000, height: 700, crop: "limit", quality: "auto", fetch_format: "auto" }] });
  } else {
    const info = await sharp(bytes, { limitInputPixels: 50_000_000 }).metadata();
    width = info.width ?? null; height = info.height ?? null;
    await Promise.all([mkdir(join(localRoot, "originals"), { recursive: true, mode: 0o700 }), mkdir(join(localRoot, "previews"), { recursive: true, mode: 0o700 })]);
    await Promise.all([
      writeFile(localOriginal, bytes, { flag: "wx", mode: 0o600 }),
      sharp(bytes, { limitInputPixels: 50_000_000 }).rotate().resize({ width: 1000, height: 700, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(localThumbnail),
    ]);
    originalUrl = "local://private-original";
    thumbnailUrl = "local://private-preview";
  }
  const previousAssets = await prisma.asset.findMany({ where: { project: { organizationId: project.organizationId }, perceptualHash: { not: null } }, select: { perceptualHash: true, milestoneId: true } });
  let vision: Awaited<ReturnType<typeof analyzeWithGemini>> | null = null;
  let analysisError: string | null = null;
  if (process.env.GEMINI_API_KEY) {
    try { vision = await analyzeWithGemini(bytes, file.type, milestone.criteria, process.env.GEMINI_API_KEY); }
    catch (error) { analysisError = error instanceof Error ? error.message : "Vision analysis failed."; console.error(analysisError); }
  }
  let score = 0, status: "RECEIVED" | "VERIFIED" | "NEEDS_REVIEW" | "REJECTED" = "RECEIVED";
  let checkResults: ReturnType<typeof scoreChecks> | null = null;
  if (vision) {
    checkResults = scoreChecks({ vision, capturedAt: metadata.capturedAt, latitude: metadata.latitude, longitude: metadata.longitude, hasExif: metadata.hasExif, software: metadata.software, fingerprint, previous: previousAssets.filter(a => a.perceptualHash).map(a => ({ fingerprint: a.perceptualHash!, milestoneId: a.milestoneId })), project, milestone });
    score = checkResults.score;
    status = checkResults.hardFail ? "REJECTED" : score >= milestone.minTrust ? "VERIFIED" : score < 0.5 ? "REJECTED" : "NEEDS_REVIEW";
  }
  const asset = await prisma.$transaction(async tx => {
    const created = await tx.asset.create({ data: { projectId, milestoneId, publicId, storageProvider, secureUrl: originalUrl, thumbnailUrl, sha256: sha256(bytes), perceptualHash: fingerprint, capturedAt: metadata.capturedAt, latitude: metadata.latitude, longitude: metadata.longitude, caption: vision?.caption ?? "Original received; vision analysis is pending configuration.", activity: vision?.activity ?? null, trustScore: score, status, analysis: { mimeType: file.type, originalName: file.name, fileSize: file.size, dimensions: { width, height }, checks: checkResults?.checks ?? null, vision, metadata: { hasExif: metadata.hasExif, software: metadata.software }, analysisError, analyzed: !!vision } } });
    const provenanceThumbnail = storageProvider === "LOCAL" ? `/api/assets/${created.id}/thumbnail` : thumbnailUrl;
    if (storageProvider === "LOCAL") await tx.asset.update({ where: { id: created.id }, data: { secureUrl: `/api/assets/${created.id}/original`, thumbnailUrl: provenanceThumbnail } });
    if (status === "VERIFIED") await tx.evidenceLink.create({ data: { assetId: created.id, claim: vision?.caption ?? milestone.title, transformationUrl: provenanceThumbnail } });
    await tx.auditLog.create({ data: { organizationId: project.organizationId, actorId: actor.id, action: "EVIDENCE_UPLOADED", entityType: "Asset", entityId: created.id, details: { milestoneId, status, trustScore: score, sha256: created.sha256 } } });
    let release = null;
    if (vision && !milestone.releasedAt) {
      const evidence = await tx.asset.findMany({ where: { milestoneId }, select: { trustScore: true } });
      const average = evidence.reduce((sum, item) => sum + item.trustScore, 0) / evidence.length;
      const verdict = average >= milestone.minTrust ? "VERIFIED" : average < 0.5 ? "REJECTED" : "NEEDS_REVIEW";
      await tx.milestone.update({ where: { id: milestoneId }, data: { trustScore: average, verdict } });
      if (average >= milestone.minTrust && !milestone.releasedAt) {
        await tx.asset.updateMany({ where: { milestoneId }, data: { status: "VERIFIED" } });
        release = await tx.ledgerEntry.create({ data: { projectId, milestoneId, type: "RELEASE", amount: milestone.amount, debitAccount: `milestone:${milestoneId}`, creditAccount: `ngo:${project.organizationId}`, idempotencyKey: `release:${milestoneId}` } });
        await tx.milestone.update({ where: { id: milestoneId }, data: { releasedAt: new Date() } });
        await tx.auditLog.create({ data: { organizationId: project.organizationId, actorId: actor.id, action: "MILESTONE_AUTO_RELEASED_SIMULATED", entityType: "Milestone", entityId: milestoneId, details: { averageTrust: average, evidenceCount: evidence.length, ledgerEntryId: release.id } } });
      }
    }
    return { created, release };
  }, { isolationLevel: "Serializable" }).catch(async error => {
    if (storageProvider === "CLOUDINARY") {
      if (cloudinaryPublicId) await cloudinary.uploader.destroy(cloudinaryPublicId, { type: "authenticated", resource_type: "image" }).catch(cleanupError => console.error("Could not clean up orphaned Cloudinary upload", cleanupError));
    } else await Promise.all([unlink(localOriginal).catch(() => undefined), unlink(localThumbnail).catch(() => undefined)]);
    if ((error as { code?: string })?.code === "P2034") return null;
    throw error;
  });
  if (!asset) return NextResponse.json({ error: "Milestone evidence changed while this upload was analyzed. Retry the upload." }, { status: 409 });
  return NextResponse.json({ asset: { id: asset.created.id, publicId: asset.created.publicId, thumbnailUrl: asset.created.thumbnailUrl.startsWith("local://") ? `/api/assets/${asset.created.id}/thumbnail` : asset.created.thumbnailUrl, caption: asset.created.caption, status: asset.created.status, trustScore: asset.created.trustScore, sha256: asset.created.sha256, capturedAt: asset.created.capturedAt, storageProvider: asset.created.storageProvider }, analysis: vision ? "complete" : process.env.GEMINI_API_KEY ? "failed" : "pending", message: analysisError, release: asset.release }, { status: 201 });
}
