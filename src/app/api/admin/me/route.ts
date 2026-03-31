import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { projectLinks } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch project links to know what the user can see globally
  const userLinks = await db
    .select()
    .from(projectLinks)
    .where(eq(projectLinks.userId, session.id));

  return NextResponse.json({
    id: session.id,
    email: session.email,
    role: session.role,
    links: userLinks
  });
}
