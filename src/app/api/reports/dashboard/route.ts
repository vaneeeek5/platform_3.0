import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, expenses, goalAchievements, trackedGoals, campaignMappings } from "@/db/schema";
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
      .select({
        id: leads.id,
        date: leads.date,
        utmCampaign: leads.utmCampaign,
      })
      .from(leads)
      .where(and(...filters));

    const dbAchievements = await db
      .select({
        leadId: goalAchievements.leadId,
        goalId: goalAchievements.goalId,
        saleAmount: goalAchievements.saleAmount,
      })
      .from(goalAchievements)
      .innerJoin(leads, eq(goalAchievements.leadId, leads.id))
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

    // Map lead to its achievements for faster lookup
    const leadMap = new Map<number, { isTarget: boolean, isSale: boolean, revenue: number }>();
    dbAchievements.forEach(a => {
      const current = leadMap.get(a.leadId) || { isTarget: false, isSale: false, revenue: 0 };
      if (targetGoalIds.has(a.goalId)) current.isTarget = true;
      const amt = Number(a.saleAmount) || 0;
      if (amt > 0) {
        current.isSale = true;
        current.revenue += amt;
      }
      leadMap.set(a.leadId, current);
    });

    // 3. Process Trends
    const days = eachDayOfInterval({ start: filterStart, end: filterEnd });
    const trendMap = new Map();
    days.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      trendMap.set(key, { 
        period: format(day, 'dd.MM'), // As in the reference
        leads: 0, 
        targetLeads: 0, 
        sales: 0,
        cost: 0 
      });
    });

    let totalLeadsCount = 0;
    let totalTargetCount = 0;
    let totalSalesCount = 0;
    let totalRevenueSum = 0;
    let totalCostSum = 0;

    const campaignStats = new Map<string, { leads: number, target: number, sales: number, cost: number, revenue: number }>();

    dbLeads.forEach(l => {
      if (isHidden(l.utmCampaign, null)) return;
      
      const lMeta = leadMap.get(l.id) || { isTarget: false, isSale: false, revenue: 0 };
      
      totalLeadsCount++;
      if (lMeta.isTarget) totalTargetCount++;
      if (lMeta.isSale) totalSalesCount++;
      totalRevenueSum += lMeta.revenue;

      const key = format(l.date, 'yyyy-MM-dd');
      const t = trendMap.get(key);
      if (t) {
        t.leads++;
        if (lMeta.isTarget) t.targetLeads++;
        if (lMeta.isSale) t.sales++;
      }
      
      const name = resolveName(l.utmCampaign, null);
      const stat = campaignStats.get(name) || { leads: 0, target: 0, sales: 0, cost: 0, revenue: 0 };
      stat.leads++;
      if (lMeta.isTarget) stat.target++;
      if (lMeta.isSale) stat.sales++;
      stat.revenue += lMeta.revenue;
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
      const stat = campaignStats.get(name) || { leads: 0, target: 0, sales: 0, cost: 0, revenue: 0 };
      stat.cost += costNum;
      campaignStats.set(name, stat);
    });

    // 4. Formatting
    const efficientCampaigns = Array.from(campaignStats.entries())
      .filter(([_, s]) => s.leads > 0)
      .map(([name, s]) => ({ name, leads: s.leads, cpl: s.cost / s.leads }))
      .sort((a, b) => a.cpl - b.cpl)
      .slice(0, 5);

    const topCampaigns = Array.from(campaignStats.entries())
      .map(([name, s]) => ({ name, leads: s.leads }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 5);

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

    return NextResponse.json({
      summary: {
        leads: totalLeadsCount,
        targetLeads: totalTargetCount,
        sales: totalSalesCount,
        cost: totalCostSum,
        revenue: totalRevenueSum,
        cpl: totalLeadsCount > 0 ? (totalCostSum / totalLeadsCount) : 0,
        romi: totalCostSum > 0 ? ((totalRevenueSum - totalCostSum) / totalCostSum) * 100 : 0
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
