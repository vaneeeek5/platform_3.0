import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, expenses, goalAchievements, campaignMappings } from "@/db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { eachDayOfInterval, format, startOfDay } from "date-fns";

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
  
  const filterStart = startOfDay(dateFrom);
  const filterEnd = new Date(dateTo);
  filterEnd.setHours(23, 59, 59, 999);

  try {
    const filters = [gte(leads.date, filterStart), lte(leads.date, filterEnd)];
    const expFilters = [gte(expenses.date, filterStart), lte(expenses.date, filterEnd)];
    
    if (projectId) {
      filters.push(eq(leads.projectId, projectId));
      expFilters.push(eq(expenses.projectId, projectId));
    }

    // 1. Fetch Mappings
    const mappings = await db.select().from(campaignMappings).where(projectId ? eq(campaignMappings.projectId, projectId) : undefined);

    const resolveName = (utmCampaign: string | null, directOrder: string | null) => {
      const mapping = mappings.find(m => {
        if (m.utmValue && m.utmValue === utmCampaign) return true;
        if (m.directValue && m.directValue === directOrder) return true;
        return false;
      });
      return mapping?.displayName || utmCampaign || directOrder || "Unknown";
    };

    const isHidden = (utmCampaign: string | null, directOrder: string | null) => {
        const name = resolveName(utmCampaign, directOrder);
        const mapping = mappings.find(m => m.displayName === name);
        return mapping?.isHidden;
    };

    // 2. Fetch Data (Get raw timestamps and resolve in JS for maximum reliability)
    const dbLeads = await db
      .select({
        date: leads.date,
        utmCampaign: leads.utmCampaign,
      })
      .from(leads)
      .where(and(...filters));

    const dbExpenses = await db
      .select({
        date: expenses.date,
        cost: expenses.cost,
        utmCampaign: expenses.utmCampaign,
        directOrder: expenses.directOrder
      })
      .from(expenses)
      .where(and(...expFilters));

    const [rawRevenue] = await db
      .select({
        sum: sql<number>`sum(CAST(${goalAchievements.saleAmount} AS FLOAT))`.mapWith(Number),
      })
      .from(goalAchievements)
      .innerJoin(leads, eq(goalAchievements.leadId, leads.id))
      .where(and(...filters));

    // 3. Process Trends
    const days = eachDayOfInterval({ start: filterStart, end: filterEnd });
    const trendMap = new Map();
    days.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      trendMap.set(key, { date: key, label: format(day, 'dd.MM'), leads: 0, cost: 0 });
    });

    let totalLeadsCount = 0;
    let totalCostSum = 0;
    const campaignStats = new Map<string, { leads: number, cost: number }>();

    dbLeads.forEach(l => {
      if (isHidden(l.utmCampaign, null)) return;
      totalLeadsCount++;
      const key = format(l.date, 'yyyy-MM-dd');
      const t = trendMap.get(key);
      if (t) t.leads++;
      
      const name = resolveName(l.utmCampaign, null);
      const stat = campaignStats.get(name) || { leads: 0, cost: 0 };
      stat.leads++;
      campaignStats.set(name, stat);
    });

    dbExpenses.forEach(e => {
      if (isHidden(e.utmCampaign, e.directOrder)) return;
      const costNum = Number(e.cost) || 0;
      totalCostSum += costNum;
      const key = format(e.date, 'yyyy-MM-dd');
      const t = trendMap.get(key);
      if (t) t.cost += costNum;
      
      const name = resolveName(e.utmCampaign, e.directOrder);
      const stat = campaignStats.get(name) || { leads: 0, cost: 0 };
      stat.cost += costNum;
      campaignStats.set(name, stat);
    });

    // 4. Sources
    const rawSources = await db
      .select({
        source: leads.utmSource,
        count: sql<number>`count(${leads.id})`.mapWith(Number),
      })
      .from(leads)
      .where(and(...filters))
      .groupBy(leads.utmSource)
      .orderBy(desc(sql`count(${leads.id})`))
      .limit(10);

    const efficientCampaigns = Array.from(campaignStats.entries())
      .filter(([_, s]) => s.leads > 0)
      .map(([name, s]) => ({ name, leads: s.leads, cpl: s.cost / s.leads }))
      .sort((a, b) => a.cpl - b.cpl)
      .slice(0, 5);

    const topCampaigns = Array.from(campaignStats.entries())
      .map(([name, s]) => ({ name, leads: s.leads }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 5);

    return NextResponse.json({
      summary: {
        leads: totalLeadsCount,
        cost: totalCostSum,
        revenue: rawRevenue?.sum || 0,
        cpl: totalLeadsCount > 0 ? (totalCostSum / totalLeadsCount) : 0,
        romi: totalCostSum > 0 ? (((rawRevenue?.sum || 0) - totalCostSum) / totalCostSum) * 100 : 0
      },
      trends: Array.from(trendMap.values()),
      sources: rawSources.map(s => ({ name: s.source || "Direct / Internal", value: s.count })),
      topCampaigns,
      efficientCampaigns
    });

  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
