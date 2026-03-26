import { NextResponse } from "next/server";
import { db } from "@/db";
import { syncLogs } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { desc } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const logs = await db.select()
      .from(syncLogs)
      .orderBy(desc(syncLogs.startedAt))
      .limit(100);
      
    return NextResponse.json(logs);
  } catch (error) {
    console.error("Failed to fetch logs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
