import { NextResponse } from "next/server";
import { db } from "@/db";
import { crmStageMappings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = parseInt(params.id);
  const data = await db
    .select()
    .from(crmStageMappings)
    .where(eq(crmStageMappings.projectId, projectId));

  return NextResponse.json(data);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = parseInt(params.id);
  const { mappings } = await request.json();

  try {
    await db.transaction(async (tx) => {
      // 1. Delete existing for this project
      await tx.delete(crmStageMappings).where(eq(crmStageMappings.projectId, projectId));
      
      // 2. Insert new ones
      if (mappings && mappings.length > 0) {
        await tx.insert(crmStageMappings).values(
          mappings.map((m: any) => ({
            projectId,
            crmStageName: m.crmStageName,
            targetStatusId: m.targetStatusId,
            qualificationStatusId: m.qualificationStatusId,
            leadStageId: m.leadStageId,
          }))
        );
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CRM Mapping update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
