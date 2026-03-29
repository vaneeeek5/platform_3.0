import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, isNotNull } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const projectId = parseInt(id);

  try {
    const records = await db
        .selectDistinct({ utmSource: leads.utmSource })
        .from(leads)
        .where(eq(leads.projectId, projectId));

    const sources = records.map(r => r.utmSource).filter(Boolean).filter(s => s !== "None");

    return NextResponse.json(sources);
  } catch (error) {
    console.error("Failed to fetch utm sources:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
