import { NextResponse } from "next/server";
import { db } from "@/db";
import { leadStages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolvedParams = await params;
  const projectId = parseInt(resolvedParams.id);
  const data = await db
    .select()
    .from(leadStages)
    .where(eq(leadStages.projectId, projectId))
    .orderBy(leadStages.sortOrder);

  return NextResponse.json(data);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolvedParams = await params;
  const projectId = parseInt(resolvedParams.id);
  const { stages } = await request.json();

  try {
    await db.transaction(async (tx) => {
      // 1. Delete existing
      await tx.delete(leadStages).where(eq(leadStages.projectId, projectId));
      
      // 2. Insert new
      if (stages && stages.length > 0) {
        await tx.insert(leadStages).values(
          stages.map((s: any, idx: number) => ({
            projectId,
            label: s.label,
            color: s.color,
            sortOrder: idx,
          }))
        );
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Lead Stages update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
