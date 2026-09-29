import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { passwordHash, startSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const input = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email().max(254), password: z.string().min(12).max(128), organization: z.string().trim().min(2).max(100) });

export async function POST(request: NextRequest) {
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Use a name, valid email, workspace name, and a password of at least 12 characters.", issues: parsed.error.flatten() }, { status: 400 });
  const { name, email, password, organization } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } })) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  let user;
  try {
    user = await prisma.$transaction(async tx => {
      const created = await tx.user.create({ data: { name, email: normalizedEmail, passwordHash: await passwordHash(password) } });
      const org = await tx.organization.create({ data: { name: organization } });
      await tx.membership.create({ data: { userId: created.id, organizationId: org.id, role: "FUNDER" } });
      return created;
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    throw error;
  }
  const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } }, { status: 201 });
  await startSession(user.id, response);
  return response;
}
