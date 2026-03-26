import { NextResponse } from "next/server";
import { db } from "@/db";
import { trackedGoals } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

// Fetch tracked goals for this project
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const projectId = parseInt(id);
  const goals = await db.select().from(trackedGoals).where(eq(trackedGoals.projectId, projectId));
  return NextResponse.json(goals);
}

// Update tracked goals
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const projectId = parseInt(id);
  const { goals } = await request.json(); // Array of { goalId, goalName }

  try {
    // Transactional update: delete old and insert new
    await db.transaction(async (tx) => {
      await tx.delete(trackedGoals).where(eq(trackedGoals.projectId, projectId));
      
      if (goals.length > 0) {
        await tx.insert(trackedGoals).values(
          goals.map((g: any) => ({
            projectId,
            goalId: g.goalId,
            goalName: g.goalName,
            isActive: true,
          }))
        );
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update tracked goals:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
