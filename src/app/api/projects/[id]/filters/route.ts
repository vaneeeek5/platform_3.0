import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, goalAchievements } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = parseInt(params.id);
  if (isNaN(projectId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  try {
    // 1. Получаем уникальные источники из таблицы leads
    const sourceResults = await db
      .select({ source: leads.utmSource })
      .from(leads)
      .where(eq(leads.projectId, projectId))
      .groupBy(leads.utmSource);

    const sources = sourceResults.map(r => r.source || 'direct').filter(Boolean);

    // 2. Получаем уникальные названия целей из таблицы goalAchievements
    // Мы делаем JOIN с leads, чтобы убедиться, что цели принадлежат именно этому проекту
    const goalResults = await db
      .select({ goalName: goalAchievements.goalName })
      .from(goalAchievements)
      .innerJoin(leads, eq(goalAchievements.leadId, leads.id))
      .where(eq(leads.projectId, projectId))
      .groupBy(goalAchievements.goalName);

    const goals = goalResults.map(r => r.goalName).filter(Boolean);

    return NextResponse.json({
      sources: Array.from(new Set(sources)).sort(),
      goals: Array.from(new Set(goals)).sort()
    });
  } catch (error) {
    console.error("Filter options fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
