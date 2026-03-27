import { NextResponse } from "next/server";
import { db } from "@/db";
import { campaignMappings } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const projectId = parseInt(id);

  try {
    // Try to select all including new isHidden column
    const results = await db.select().from(campaignMappings).where(eq(campaignMappings.projectId, projectId));
    return NextResponse.json(results);
  } catch (e) {
    // FALLBACK: If DB is not migrated yet, select only old columns
    console.warn("[CampaignMappings] Column is_hidden likely missing, falling back...");
    const results = await db.select({
      id: campaignMappings.id,
      projectId: campaignMappings.projectId,
      utmValue: campaignMappings.utmValue,
      directValue: campaignMappings.directValue,
      displayName: campaignMappings.displayName
    })
    .from(campaignMappings)
    .where(eq(campaignMappings.projectId, projectId));
    return NextResponse.json(results);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const projectId = parseInt(id);
  const { mappings } = await request.json(); 

  try {
    await db.transaction(async (tx) => {
      await tx.delete(campaignMappings).where(eq(campaignMappings.projectId, projectId));
      
      if (mappings.length > 0) {
        const validMappings = mappings
          .filter((m: any) => (m.utmValue || m.directValue) && m.displayName)
          .map((m: any) => ({
            projectId,
            utmValue: m.utmValue || null,
            directValue: m.directValue || null,
            displayName: m.displayName,
            isHidden: m.isHidden || false,
          }));

        if (validMappings.length > 0) {
           await tx.insert(campaignMappings).values(validMappings);
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update campaign mappings:", error);
    return NextResponse.json({ error: "Internal server error. Note: Schema migration might be needed." }, { status: 500 });
  }
}
