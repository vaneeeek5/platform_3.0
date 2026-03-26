import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { addSyncJob } from "@/lib/queue";

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
    console.log(`[Sync Route] Triggering sync for project ${projectId}, period: ${dateFrom} to ${dateTo}`);
    
    await addSyncJob(projectId, dateFrom, dateTo);
    return NextResponse.json({ success: true, message: "Sync job added to queue" });
  } catch (error) {
    console.error("Failed to add sync job:", error);
    return NextResponse.json({ error: "Failed to queue sync job" }, { status: 500 });
  }
}
