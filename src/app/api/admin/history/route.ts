import { NextResponse } from "next/server";
import { db } from "@/db";
import { changeHistory, users, projects } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { desc, eq, and } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await getSession();
  
  // Strict check: only Super Admin can see history
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userIdParam = searchParams.get("userId");
  const projectIdParam = searchParams.get("projectId");
  const limit = parseInt(searchParams.get("limit") || "100");

  try {
    let whereClause: any[] = [];
    
    if (userIdParam) {
        whereClause.push(eq(changeHistory.changedBy, parseInt(userIdParam)));
    }
    if (projectIdParam && projectIdParam !== "0") {
        whereClause.push(eq(changeHistory.projectId, parseInt(projectIdParam)));
    }

    const logs = await db.select({
      id: changeHistory.id,
      entityType: changeHistory.entityType,
      entityId: changeHistory.entityId,
      field: changeHistory.field,
      oldValue: changeHistory.oldValue,
      newValue: changeHistory.newValue,
      changedAt: changeHistory.changedAt,
      source: changeHistory.source,
      userEmail: users.email,
      projectName: projects.name,
    })
    .from(changeHistory)
    .leftJoin(users, eq(changeHistory.changedBy, users.id))
    .leftJoin(projects, eq(changeHistory.projectId, projects.id))
    .where(and(...whereClause))
    .orderBy(desc(changeHistory.changedAt))
    .limit(limit);
      
    return NextResponse.json(logs);
  } catch (error) {
    console.error("Failed to fetch history logs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
