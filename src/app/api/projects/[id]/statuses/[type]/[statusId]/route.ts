import { NextResponse } from "next/server";
import { db } from "@/db";
import { targetStatuses, qualificationStatuses, saleStatuses, leadStages } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string, type: string, statusId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, type, statusId } = await params;
  const projectId = parseInt(id);
  const sId = parseInt(statusId);
  const body = await request.json();
  const table = type === "target" ? targetStatuses : 
                type === "qualification" ? qualificationStatuses : 
                type === "sale" ? saleStatuses : 
                leadStages;

  const updates: any = {};
  if (body.label !== undefined) updates.label = body.label;
  if (body.color !== undefined) updates.color = body.color;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
  if (body.isPositive !== undefined) updates.isPositive = body.isPositive;

  const [updated] = await db.update(table)
    .set(updates)
    .where(and(eq(table.id, sId), eq(table.projectId, projectId)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string, type: string, statusId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, type, statusId } = await params;
  const projectId = parseInt(id);
  const sId = parseInt(statusId);
  const table = type === "target" ? targetStatuses : 
                type === "qualification" ? qualificationStatuses : 
                type === "sale" ? saleStatuses : 
                leadStages;

  await db.delete(table).where(and(eq(table.id, sId), eq(table.projectId, projectId)));
  
  return NextResponse.json({ ok: true });
}
