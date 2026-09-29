import { NextRequest, NextResponse } from "next/server";
import { getActor } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const actor = await getActor(request);
  return NextResponse.json({ user: actor && { id: actor.id, name: actor.name, email: actor.email, memberships: actor.memberships } });
}
