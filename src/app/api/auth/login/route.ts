import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { passwordMatches, startSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const input = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) });
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;
const keyFor = (value: string) => createHash("sha256").update(value).digest("hex");

async function isBlocked(keys: string[], now: Date) {
  const limits = await prisma.loginThrottle.findMany({ where: { key: { in: keys } } });
  return limits.some(limit => limit.blockedUntil && limit.blockedUntil > now || limit.windowStartedAt.getTime() + WINDOW_MS > now.getTime() && limit.failures >= MAX_FAILURES);
}
async function recordFailure(keys: string[], now: Date) {
  await prisma.$transaction(keys.map(key => prisma.loginThrottle.upsert({ where: { key }, create: { key, failures: 1, windowStartedAt: now }, update: { failures: { increment: 1 } } })));
  await prisma.loginThrottle.updateMany({ where: { key: { in: keys }, windowStartedAt: { lt: new Date(now.getTime() - WINDOW_MS) } }, data: { failures: 1, windowStartedAt: now, blockedUntil: null } });
  await prisma.loginThrottle.updateMany({ where: { key: { in: keys }, failures: { gte: MAX_FAILURES } }, data: { blockedUntil: new Date(now.getTime() + WINDOW_MS) } });
}

export async function POST(request: NextRequest) {
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
  const keys = [`email:${keyFor(email)}`, ...(ip ? [`ip:${keyFor(ip)}`] : [])];
  const now = new Date();
  await prisma.loginThrottle.deleteMany({ where: { updatedAt: { lt: new Date(now.getTime() - 30 * 86400000) } } });
  if (await isBlocked(keys, now)) return NextResponse.json({ error: "Too many sign-in attempts. Wait 15 minutes and try again." }, { status: 429, headers: { "Retry-After": "900" } });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await passwordMatches(parsed.data.password, user.passwordHash))) {
    await recordFailure(keys, now);
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }
  await prisma.loginThrottle.deleteMany({ where: { key: { in: keys } } });
  const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  await startSession(user.id, response);
  return response;
}
