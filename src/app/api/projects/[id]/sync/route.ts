import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { syncMetrikaLeads } from "@/lib/sync/yandex-metrika";
import { syncDirectExpenses } from "@/lib/sync/yandex-direct";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const projectId = parseInt(id);

  try {
    const body = await request.json().catch(() => ({}));
    const { dateFrom, dateTo } = body;
    
    console.log(`[Sync] Starting sync for project ${projectId}, period: ${dateFrom} to ${dateTo}`);

    // Run sync directly in the API route (no worker needed for manual syncs)
    const metrikaResult = await syncMetrikaLeads(projectId, dateFrom, dateTo);
    console.log(`[Sync] Metrika result:`, metrikaResult);

    const directResult = await syncDirectExpenses(projectId, dateFrom, dateTo);
    console.log(`[Sync] Direct result:`, directResult);

    await db.update(projects).set({ lastSyncAt: new Date() }).where(eq(projects.id, projectId));

    return NextResponse.json({ 
      success: true, 
      metrika: metrikaResult, 
      direct: directResult 
    });
  } catch (error: any) {
    console.error("[Sync] Failed:", error);
    return NextResponse.json({ error: error.message || "Sync failed" }, { status: 500 });
  }
}
