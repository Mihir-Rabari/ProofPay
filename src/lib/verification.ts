import { createHash } from "node:crypto";
import sharp from "sharp";
import { parse as parseExif } from "exifr";

export type CheckResult = { score: number; detail: string };
export type VisionResult = { activity: string; caption: string; relevance: number; stagedOrStock: number; condition: string; reasons: string[]; counts: Record<string, number> };

export async function imageFingerprint(bytes: Buffer) {
  const gray = await sharp(bytes, { limitInputPixels: 50_000_000 }).resize(9, 8, { fit: "fill" }).greyscale().raw().toBuffer();
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += gray[y * 9 + x] > gray[y * 9 + x + 1] ? "1" : "0";
  return BigInt(`0b${bits}`).toString(16).padStart(16, "0");
}

export function hammingHex(left: string, right: string) {
  let value = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let count = 0;
  while (value) { count++; value &= value - BigInt(1); }
  return count;
}

function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number) {
  const r = 6371000, rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const v = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(v));
}

export async function captureMetadata(bytes: Buffer) {
  const data = await parseExif(bytes, { gps: true, tiff: true, exif: true }).catch(() => null) as Record<string, unknown> | null;
  const latitude = typeof data?.latitude === "number" ? data.latitude : null;
  const longitude = typeof data?.longitude === "number" ? data.longitude : null;
  const capturedAtRaw = data?.DateTimeOriginal ?? data?.CreateDate ?? data?.DateTimeDigitized;
  const capturedAt = capturedAtRaw instanceof Date ? capturedAtRaw : typeof capturedAtRaw === "string" ? new Date(capturedAtRaw) : null;
  return { latitude, longitude, capturedAt: capturedAt && !Number.isNaN(capturedAt.valueOf()) ? capturedAt : null, hasExif: !!data, software: typeof data?.Software === "string" ? data.Software : null };
}

export async function analyzeWithGemini(bytes: Buffer, mimeType: string, criteria: string, apiKey: string): Promise<VisionResult> {
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: "You inspect field evidence for an impact-finance audit. Be conservative. Never infer counts that are not clearly visible. Return only the requested JSON. A photo cannot prove when or where it was taken. Relevance is visual relevance only, not proof of completion." }] },
      contents: [{ role: "user", parts: [{ text: `Milestone visual criteria: ${criteria}\nAnalyze this field image. Set relevance from 0 to 1; stagedOrStock from 0 to 1. Describe visible objects/activity, condition (before, in_progress, complete, unclear), short caption, reasons, and only confident numeric counts.` }, { inlineData: { mimeType, data: bytes.toString("base64") } }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { activity: { type: "STRING" }, caption: { type: "STRING" }, relevance: { type: "NUMBER" }, stagedOrStock: { type: "NUMBER" }, condition: { type: "STRING" }, reasons: { type: "ARRAY", items: { type: "STRING" } }, counts: { type: "OBJECT", additionalProperties: { type: "INTEGER" } } }, required: ["activity", "caption", "relevance", "stagedOrStock", "condition", "reasons", "counts"] } },
    }), signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`Gemini analysis failed (${response.status}).`);
  const body = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const output = body.candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("");
  if (!output) throw new Error("Gemini returned an empty result.");
  const result = JSON.parse(output) as VisionResult;
  if (typeof result.relevance !== "number" || typeof result.stagedOrStock !== "number" || typeof result.caption !== "string") throw new Error("Gemini returned an invalid analysis shape.");
  result.relevance = Math.max(0, Math.min(1, result.relevance));
  result.stagedOrStock = Math.max(0, Math.min(1, result.stagedOrStock));
  return result;
}

export function scoreChecks(args: { vision: VisionResult; capturedAt: Date | null; latitude: number | null; longitude: number | null; hasExif: boolean; software: string | null; fingerprint: string; previous: { fingerprint: string; milestoneId: string | null }[]; project: { latitude: number | null; longitude: number | null; geofenceRadiusM: number }; milestone: { createdAt: Date; dueAt: Date } }) {
  const duplicates = args.previous.map(p => ({ ...p, distance: hammingHex(args.fingerprint, p.fingerprint) })).sort((a, b) => a.distance - b.distance);
  const duplicate = duplicates[0];
  const unique = duplicate && duplicate.distance <= 4 ? 0 : duplicate && duplicate.distance <= 8 ? 0.5 : 1;
  const gpsDistance = args.latitude !== null && args.longitude !== null && args.project.latitude !== null && args.project.longitude !== null ? distanceMeters(args.latitude, args.longitude, args.project.latitude, args.project.longitude) : null;
  const gps = gpsDistance === null ? 0.5 : gpsDistance <= args.project.geofenceRadiusM ? 1 : Math.max(0, 1 - (gpsDistance - args.project.geofenceRadiusM) / args.project.geofenceRadiusM);
  const daysFromReceipt = args.capturedAt ? Math.abs(Date.now() - args.capturedAt.getTime()) / 86400000 : null;
  const withinWindow = !!args.capturedAt && args.capturedAt >= args.milestone.createdAt && args.capturedAt <= new Date(args.milestone.dueAt.getTime() + 7 * 86400000);
  const time = args.capturedAt ? (withinWindow ? 1 : daysFromReceipt! > 7 ? 0 : 0.45) : 0.35;
  const integrity = args.hasExif && !args.software ? 1 : args.hasExif ? 0.65 : 0.45;
  const quality = 0.5;
  const relevance = args.vision.relevance * (1 - args.vision.stagedOrStock);
  const score = Math.max(0, Math.min(1, 0.3 * relevance + 0.2 * unique + 0.2 * gps + 0.15 * time + 0.1 * integrity + 0.05 * quality));
  const hardFail = !!duplicate && duplicate.distance <= 4 && duplicate.milestoneId !== null || gpsDistance !== null && gpsDistance > args.project.geofenceRadiusM * 2 || !!args.capturedAt && !withinWindow && daysFromReceipt! > 7;
  return {
    score: hardFail ? 0 : score,
    hardFail,
    checks: [
      { label: "Visual relevance", score: relevance, detail: args.vision.reasons.join("; ") || "Vision model matched the visual criteria" },
      { label: "Originality", score: unique, detail: duplicate && duplicate.distance <= 8 ? `Closest image hash is ${duplicate.distance} bits away` : "No near-duplicate in the workspace" },
      { label: "GPS consistency", score: gps, detail: gpsDistance === null ? "Image GPS or project coordinates missing" : `${Math.round(gpsDistance)} m from project pin` },
      { label: "Capture time", score: time, detail: args.capturedAt ? (withinWindow ? "EXIF time within milestone window" : "EXIF time outside milestone window") : "No original capture time in EXIF" },
      { label: "Metadata integrity", score: integrity, detail: args.software ? `Editing software tag present: ${args.software}` : args.hasExif ? "EXIF metadata present; no editing software tag" : "EXIF metadata missing" },
      { label: "Image quality", score: quality, detail: "Neutral score: blur and exposure analysis is not configured" },
    ],
  };
}

export function sha256(bytes: Buffer) { return createHash("sha256").update(bytes).digest("hex"); }
