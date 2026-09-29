import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({ projectId: z.string().min(1).max(100), milestoneId: z.string().min(1).max(100) });

export async function POST(request: NextRequest) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return NextResponse.json({ error: "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET." }, { status: 503 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "projectId and milestoneId are required" }, { status: 400 });
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `proofpay/${parsed.data.projectId}/${parsed.data.milestoneId}`;
  const params = { folder, timestamp };
  const toSign = Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("&");
  const signature = createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex");
  return NextResponse.json({ cloudName, apiKey, timestamp, folder, signature, uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload` });
}
