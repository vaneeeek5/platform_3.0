import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, goalAchievements } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and, sql } from "drizzle-orm";

// GET: find duplicate leads by metrikaVisitId within a project
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = parseInt(searchParams.get("projectId") || "");
  if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

  try {
    // Find visitIDs that appear more than once
    const duplicates = await db.execute(sql`
      SELECT metrika_visit_id, COUNT(*) as cnt, array_agg(id ORDER BY id) as ids
      FROM leads
      WHERE project_id = ${projectId}
      GROUP BY metrika_visit_id
      HAVING COUNT(*) > 1
    `);

    const rows = duplicates.rows as any[];
    const duplicateCount = rows.reduce((acc, r) => acc + (parseInt(r.cnt) - 1), 0);
    
    return NextResponse.json({ duplicateCount, groups: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: remove duplicate leads, keeping the lowest ID for each visitId
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = parseInt(searchParams.get("projectId") || "");
  if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

  try {
    // Delete duplicates keeping oldest (min id) per visitId
    const result = await db.execute(sql`
      DELETE FROM leads
      WHERE project_id = ${projectId}
        AND id NOT IN (
          SELECT MIN(id) FROM leads
          WHERE project_id = ${projectId}
          GROUP BY metrika_visit_id
        )
    `);

    // Also clean up duplicate goal achievements
    await db.execute(sql`
      DELETE FROM goal_achievements
      WHERE id NOT IN (
        SELECT MIN(id) FROM goal_achievements
        GROUP BY lead_id, goal_id
      )
    `);

    return NextResponse.json({ success: true, deleted: result.rowCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
