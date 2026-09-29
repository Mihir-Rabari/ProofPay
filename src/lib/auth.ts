import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const scrypt = promisify(scryptCallback);
const COOKIE = "proofpay_session";
const SESSION_DAYS = 7;
export type Actor = { id: string; name: string; email: string; memberships: { organizationId: string; organizationName: string; role: string }[] };

export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function passwordMatches(password: string, encoded: string) {
  const [scheme, salt, stored] = encoded.split(":");
  if (scheme !== "scrypt" || !salt || !stored) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(stored, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function digest(token: string) { return createHash("sha256").update(token).digest("hex"); }

export async function startSession(userId: string, response: NextResponse) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { tokenHash: digest(token), userId, expiresAt } });
  response.cookies.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
  return token;
}

export async function revokeSession(request: NextRequest, response: NextResponse) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? request.cookies.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: digest(token) } });
  response.cookies.set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: new Date(0) });
}

export async function getActor(request: NextRequest): Promise<Actor | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? request.cookies.get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: digest(token) }, include: { user: { include: { memberships: { include: { organization: true } } } } } });
  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    return null;
  }
  return { id: session.user.id, name: session.user.name, email: session.user.email, memberships: session.user.memberships.map(m => ({ organizationId: m.organizationId, organizationName: m.organization.name, role: m.role })) };
}

export function requireRole(actor: Actor, organizationId: string, roles: string[]) {
  const membership = actor.memberships.find(m => m.organizationId === organizationId);
  return membership && roles.includes(membership.role) ? membership : null;
}
