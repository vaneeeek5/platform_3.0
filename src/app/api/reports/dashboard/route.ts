import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, expenses, goalAchievements, projects } from "@/db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectIdStr = searchParams.get("projectId");
  const projectId = projectIdStr && projectIdStr !== "0" ? parseInt(projectIdStr) : null;
  const dateFromStr = searchParams.get("dateFrom");
  const dateToStr = searchParams.get("dateTo");

  const dateFrom = dateFromStr ? new Date(dateFromStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dateTo = dateToStr ? new Date(dateToStr) : new Date();

  try {
    const filters = [gte(leads.date, dateFrom), lte(leads.date, dateTo)];
    const expenseFilters = [gte(expenses.date, dateFrom), lte(expenses.date, dateTo)];
    
    if (projectId) {
      filters.push(eq(leads.projectId, projectId));
      expenseFilters.push(eq(expenses.projectId, projectId));
    }

    // 1. KPI Aggregates
    const [totalLeads] = await db
      .select({ count: sql<number>`count(${leads.id})`.mapWith(Number) })
      .from(leads)
      .where(and(...filters));

    const [totalCost] = await db
      .select({ sum: sql<number>`sum(${expenses.cost})`.mapWith(Number) })
      .from(expenses)
      .where(and(...expenseFilters));

    const [totalRev] = await db
      .select({ sum: sql<number>`sum(CAST(${goalAchievements.saleAmount} AS FLOAT))`.mapWith(Number) })
      .from(goalAchievements)
      .innerJoin(leads, eq(goalAchievements.leadId, leads.id))
      .where(and(...filters));

    // 2. Daily Trends
    const leadTrends = await db
      .select({
        date: sql<string>`DATE(${leads.date})`.as("d"),
        count: sql<number>`count(${leads.id})`.mapWith(Number),
      })
      .from(leads)
      .where(and(...filters))
      .groupBy(sql`d`)
      .orderBy(sql`d`);

    const expenseTrends = await db
      .select({
        date: sql<string>`DATE(${expenses.date})`.as("d"),
        cost: sql<number>`sum(${expenses.cost})`.mapWith(Number),
      })
      .from(expenses)
      .where(and(...expenseFilters))
      .groupBy(sql`d`)
      .orderBy(sql`d`);

    // 3. Source Distribution
    const sources = await db
      .select({
        source: leads.utmSource,
        count: sql<number>`count(${leads.id})`.mapWith(Number),
      })
      .from(leads)
      .where(and(...filters))
      .groupBy(leads.utmSource)
      .orderBy(desc(sql`count`))
      .limit(10);

    // 4. Merge Trends for Chart (Frontend friendly)
    const trendMap = new Map();
    leadTrends.forEach(t => trendMap.set(t.date, { date: t.date, leads: t.count, cost: 0 }));
    expenseTrends.forEach(t => {
      const existing = trendMap.get(t.date) || { date: t.date, leads: 0, cost: 0 };
      existing.cost = t.cost;
      trendMap.set(t.date, existing);
    });

    return NextResponse.json({
      summary: {
        leads: totalLeads?.count || 0,
        cost: totalCost?.sum || 0,
        revenue: totalRev?.sum || 0,
        cpl: totalLeads?.count > 0 ? (totalCost?.sum / totalLeads.count) : 0,
        romi: totalCost?.sum > 0 ? ((totalRev?.sum - totalCost.sum) / totalCost.sum) * 100 : 0
      },
      trends: Array.from(trendMap.values()).sort((a,b) => a.date.localeCompare(b.date)),
      sources: sources.map(s => ({ name: s.source || "Direct / Internal", value: s.count }))
    });

  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
