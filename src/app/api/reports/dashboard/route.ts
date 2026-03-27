import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, expenses, goalAchievements, trackedGoals, campaignMappings } from "@/db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { eachDayOfInterval, format, startOfDay, addDays } from "date-fns";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectIdStr = searchParams.get("projectId");
  const projectId = projectIdStr && projectIdStr !== "0" ? parseInt(projectIdStr) : null;
  const dateFromStr = searchParams.get("dateFrom");
  const dateToStr = searchParams.get("dateTo");

  // Normalize range
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

    // 1. Fetch Mappings and Tracked Goals
    const [projectMappings, activeGoals] = await Promise.all([
      db.select().from(campaignMappings).where(projectId ? eq(campaignMappings.projectId, projectId) : undefined),
      db.select().from(trackedGoals).where(and(projectId ? eq(trackedGoals.projectId, projectId) : undefined, eq(trackedGoals.isActive, true)))
    ]);
    const targetGoalIds = new Set(activeGoals.map(g => g.goalId));

    const resolveName = (utmCampaign: string | null, directOrder: string | null) => {
      const mapping = projectMappings.find(m => {
        if (m.utmValue && m.utmValue === utmCampaign) return true;
        if (m.directValue && m.directValue === directOrder) return true;
        return false;
      });
      return mapping?.displayName || utmCampaign || directOrder || "Unknown";
    };

    const isHidden = (utmCampaign: string | null, directOrder: string | null) => {
        const name = resolveName(utmCampaign, directOrder);
        const mapping = projectMappings.find(m => m.displayName === name);
        return mapping?.isHidden;
    };

    // 2. Fetch Data
    const dbLeads = await db
      .select({ id: leads.id, date: leads.date, utmCampaign: leads.utmCampaign })
      .from(leads).where(and(...filters));

    const dbAchievements = await db
      .select({ leadId: goalAchievements.leadId, goalId: goalAchievements.goalId, saleAmount: goalAchievements.saleAmount })
      .from(goalAchievements)
      .innerJoin(leads, eq(goalAchievements.leadId, leads.id))
      .where(and(...filters));

    const dbExpenses = await db
      .select({ date: expenses.date, cost: expenses.cost, utmCampaign: expenses.utmCampaign, directOrder: expenses.directOrder })
      .from(expenses).where(and(...expFilters));

    // Map lead to its achievements
    const leadMetaMap = new Map<number, { isTarget: boolean, isSale: boolean, revenue: number }>();
    dbAchievements.forEach(a => {
      const current = leadMetaMap.get(a.leadId) || { isTarget: false, isSale: false, revenue: 0 };
      if (targetGoalIds.has(a.goalId)) current.isTarget = true;
      const amt = Number(a.saleAmount) || 0;
      if (amt > 0) { current.isSale = true; current.revenue += amt; }
      leadMetaMap.set(a.leadId, current);
    });

    // 3. Process Trends
    const trendMap = new Map();
    const days = eachDayOfInterval({ start: filterStart, end: filterEnd });
    days.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      trendMap.set(key, { period: format(day, 'dd.MM'), leads: 0, targetLeads: 0, sales: 0, cost: 0 });
    });

    let totalLeadsCount = 0;
    let totalTargetCount = 0;
    let totalSalesCount = 0;
    let totalRevSum = 0;
    let totalCostSum = 0;
    const campaignStats = new Map<string, { leads: number, cost: number, rev: number }>();

    dbLeads.forEach(l => {
      if (isHidden(l.utmCampaign, null)) return;
      const lMeta = leadMetaMap.get(l.id) || { isTarget: false, isSale: false, revenue: 0 };
      
      totalLeadsCount++;
      if (lMeta.isTarget) totalTargetCount++;
      if (lMeta.isSale) totalSalesCount++;
      totalRevSum += lMeta.revenue;

      const key = format(l.date, 'yyyy-MM-dd');
      const t = trendMap.get(key);
      if (t) {
        t.leads++;
        if (lMeta.isTarget) t.targetLeads++;
        if (lMeta.isSale) t.sales++;
      }
      
      const name = resolveName(l.utmCampaign, null);
      const s = campaignStats.get(name) || { leads: 0, cost: 0, rev: 0 };
      s.leads++;
      s.rev += lMeta.revenue;
      campaignStats.set(name, s);
    });

    dbExpenses.forEach(e => {
      if (isHidden(e.utmCampaign, e.directOrder)) return;
      const c = Number(e.cost) || 0;
      totalCostSum += c;
      const key = format(e.date, 'yyyy-MM-dd');
      const t = trendMap.get(key);
      if (t) t.cost += c;
      
      const name = resolveName(e.utmCampaign, e.directOrder);
      const s = campaignStats.get(name) || { leads: 0, cost: 0, rev: 0 };
      s.cost += c;
      campaignStats.set(name, s);
    });

    // Logging for analysis
    console.log(`[Dash] Range: ${format(filterStart, 'yyyy-MM-dd')} to ${format(filterEnd, 'yyyy-MM-dd')}`);
    console.log(`[Dash] Total Leads: ${totalLeadsCount}, Total Trends with data: ${Array.from(trendMap.values()).filter(t => t.leads > 0 || t.cost > 0).length}`);

    const efficientCampaigns = Array.from(campaignStats.entries())
      .filter(([_, s]) => s.leads > 0)
      .map(([name, s]) => ({ name, leads: s.leads, cpl: s.cost / s.leads }))
      .sort((a, b) => a.cpl - b.cpl).slice(0, 5);

    const topByLeads = Array.from(campaignStats.entries())
      .map(([name, s]) => ({ name, leads: s.leads }))
      .sort((a, b) => b.leads - a.leads).slice(0, 5);

    const sources = await db
      .select({ source: leads.utmSource, count: sql<number>`count(${leads.id})`.mapWith(Number) })
      .from(leads).where(and(...filters)).groupBy(leads.utmSource).orderBy(desc(sql`count`)).limit(10);

    return NextResponse.json({
      summary: {
        leads: totalLeadsCount,
        targetLeads: totalTargetCount,
        sales: totalSalesCount,
        cost: totalCostSum,
        revenue: totalRevSum,
        cpl: totalLeadsCount > 0 ? totalCostSum / totalLeadsCount : 0,
        romi: totalCostSum > 0 ? ((totalRevSum - totalCostSum) / totalCostSum) * 100 : 0
      },
      trends: Array.from(trendMap.values()),
      sources: sources.map(s => ({ name: s.source || "Direct / Internal", value: s.count })),
      topCampaigns: topByLeads,
      efficientCampaigns
    });
  } catch (err) {
    console.error("Dashboard API Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
