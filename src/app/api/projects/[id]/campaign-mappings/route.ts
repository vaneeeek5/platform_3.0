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

  const results = await db.select().from(campaignMappings).where(eq(campaignMappings.projectId, projectId));
  return NextResponse.json(results);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const projectId = parseInt(id);
  const { mappings } = await request.json(); // Array of { utmValue, directValue, displayName }

  try {
    await db.transaction(async (tx) => {
      await tx.delete(campaignMappings).where(eq(campaignMappings.projectId, projectId));
      
      if (mappings.length > 0) {
        // Filter valid mappings (must have at least one of utmValue/directValue AND a displayName)
        const validMappings = mappings
          .filter((m: any) => (m.utmValue || m.directValue) && m.displayName)
          .map((m: any) => ({
            projectId,
            utmValue: m.utmValue || null,
            directValue: m.directValue || null,
            displayName: m.displayName,
            normalizedName: m.displayName.toLowerCase(),
          }));

        if (validMappings.length > 0) {
           await tx.insert(campaignMappings).values(validMappings);
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update campaign mappings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
