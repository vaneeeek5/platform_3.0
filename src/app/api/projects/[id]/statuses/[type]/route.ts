import { NextResponse } from "next/server";
import { db } from "@/db";
import { targetStatuses, qualificationStatuses, leadStages } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string, type: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, type } = await params;
  const projectId = parseInt(id);
  const table = type === "target" ? targetStatuses : type === "qualification" ? qualificationStatuses : leadStages;

  const results = await db.select().from(table).where(eq(table.projectId, projectId)).orderBy(table.sortOrder);
  return NextResponse.json(results);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string, type: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, type } = await params;
  const projectId = parseInt(id);
  const { label, color, isPositive } = await request.json();
  const isTarget = type === "target";
  const table = isTarget ? targetStatuses : type === "qualification" ? qualificationStatuses : leadStages;

  const values: any = {
    projectId,
    label,
    color,
  };
  
  if (isPositive !== undefined) {
    values.isPositive = isPositive;
  }

  const [newStatus] = await db.insert(table).values(values).returning();

  return NextResponse.json(newStatus);
}
