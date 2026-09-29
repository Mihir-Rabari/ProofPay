import { NextResponse } from "next/server";

export async function GET() {
  const services: Record<string, string> = { web: "ok", database: "not configured", cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? "configured" : "demo mode" };
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    services.database = "ok";
  } catch {
    services.database = "unavailable";
  }
  return NextResponse.json({ name: "ProofPay API", status: services.database === "ok" ? "ok" : "degraded", services }, { status: 200 });
}
