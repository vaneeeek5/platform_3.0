import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { db } from "@/db";
import { leads, expenses, goalAchievements, trackedGoals, campaignMappings, targetStatuses, qualificationStatuses, projectLinks } from "@/db/schema";
import { eq, and, gte, lte, sql, desc, inArray } from "drizzle-orm";
import { getMoscowDateRange } from "@/lib/date-utils";
import { getSession } from "@/lib/auth";
import { verifyProjectAccess } from "@/lib/permissions";
import { eachDayOfInterval, format, startOfDay, startOfWeek, startOfMonth, eachWeekOfInterval, eachMonthOfInterval, isSameDay, isSameWeek, isSameMonth } from "date-fns";
import { ru } from "date-fns/locale";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectIdStr = searchParams.get("projectId");
  const isAllProjects = projectIdStr === "0" || !projectIdStr;
  
  if (isAllProjects && session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Access to 'All Projects' is restricted to Super Admins" }, { status: 403 });
  }

  const projectId = !isAllProjects ? parseInt(projectIdStr!) : null;

  // Check project access for regular users
  if (projectId) {
    const hasAccess = await verifyProjectAccess(session.id, session.role, projectId, 'canViewDashboard');
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden: No access to this dashboard" }, { status: 403 });
    }
  }

  const dateFromStr = searchParams.get("dateFrom");
  const dateToStr = searchParams.get("dateTo");
  const granularity = searchParams.get("granularity") || "day";

  // Normalize range to Moscow Time boundaries
  const mDateFrom = dateFromStr ? getMoscowDateRange(dateFromStr) : null;
  const mDateTo = dateToStr ? getMoscowDateRange(dateToStr) : null;

  const filterStart = mDateFrom?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const filterEnd = mDateTo?.end || new Date();


  try {
    const filters = [gte(leads.date, filterStart), lte(leads.date, filterEnd)];
    const expFilters = [gte(expenses.date, filterStart), lte(expenses.date, filterEnd)];
    
    if (projectId) {
      filters.push(eq(leads.projectId, projectId));
      expFilters.push(eq(expenses.projectId, projectId));
    }

    // 1. Fetch Mappings, Tracked Goals and Positive Statuses
    const [projectMappings, activeGoals, allTargetStatuses, allQualStatuses] = await Promise.all([
      db.select().from(campaignMappings).where(projectId ? eq(campaignMappings.projectId, projectId) : undefined),
      db.select().from(trackedGoals).where(and(projectId ? eq(trackedGoals.projectId, projectId) : undefined, eq(trackedGoals.isActive, true))),
      db.select().from(targetStatuses).where(projectId ? eq(targetStatuses.projectId, projectId) : undefined),
      db.select().from(qualificationStatuses).where(projectId ? eq(qualificationStatuses.projectId, projectId) : undefined)
    ]);
    
    const targetGoalIds = new Set(activeGoals.map(g => g.goalId));
    const positiveStatusIds = new Set(allTargetStatuses.filter(s => s.isPositive).map(s => s.id));
    const positiveQualIds = new Set(allQualStatuses.filter(s => s.isPositive).map(s => s.id));

    const resolveName = (utmCampaign: string | null, directOrder: string | null, utmSource: string | null = null) => {
      // Clean up common macro tags like {mk_kviz} -> mk_kviz
      const cleanUtm = utmCampaign?.replace(/^\{(.*)\}$/, '$1');
      const cleanDirect = directOrder?.toString().replace(/^\{(.*)\}$/, '$1');

      const mapping = projectMappings.find(m => {
        // Match by UTM (cleaned)
        if (m.utmValue && cleanUtm && m.utmValue.toLowerCase() === cleanUtm.toLowerCase()) return true;
        // Match by Direct ID or Order
        if (m.directValue && cleanDirect && m.directValue.toLowerCase() === cleanDirect.toLowerCase()) return true;
        // Fallback to raw UTM match
        if (m.utmValue && utmCampaign && m.utmValue.toLowerCase() === utmCampaign.toLowerCase()) return true;
        return false;
      });

      if (mapping?.displayName) return mapping.displayName;
      if (cleanUtm) return cleanUtm;
      if (cleanDirect) return cleanDirect;
      if (utmSource) return `Source: ${utmSource}`;
      return "Direct / Unknown";
    };

    const isHidden = (utmCampaign: string | null, directOrder: string | null, utmSource: string | null = null) => {
        const name = resolveName(utmCampaign, directOrder, utmSource);
        const mapping = projectMappings.find(m => m.displayName === name);
        return mapping?.isHidden;
    };

    // 2. Fetch Data
    const dbLeads = await db
      .select({ id: leads.id, date: leads.date, utmCampaign: leads.utmCampaign, utmSource: leads.utmSource })
      .from(leads).where(and(...filters));

    const dbAchievements = await db
      .select({ 
        leadId: goalAchievements.leadId, 
        goalId: goalAchievements.goalId, 
        saleAmount: goalAchievements.saleAmount, 
        targetStatusId: goalAchievements.targetStatusId,
        qualificationStatusId: goalAchievements.qualificationStatusId
      })
      .from(goalAchievements)
      .innerJoin(leads, eq(goalAchievements.leadId, leads.id))
      .where(and(...filters));

    const dbExpenses = await db
      .select({ date: expenses.date, cost: expenses.cost, utmCampaign: expenses.utmCampaign, directOrder: expenses.directOrder })
      .from(expenses).where(and(...expFilters));

    // Map lead to its achievements
    const leadMetaMap = new Map<number, { isTarget: boolean, isQual: boolean, isSale: boolean, revenue: number }>();
    dbAchievements.forEach(a => {
      const current = leadMetaMap.get(a.leadId) || { isTarget: false, isQual: false, isSale: false, revenue: 0 };
      
      // Update: Count as Target ONLY if goal is tracked AND status is marked as Positive
      if (targetGoalIds.has(a.goalId)) {
        if (a.targetStatusId !== null && positiveStatusIds.has(a.targetStatusId)) {
          current.isTarget = true;
        }
        if (a.qualificationStatusId !== null && positiveQualIds.has(a.qualificationStatusId)) {
          current.isQual = true;
        }
      }
      
      const amt = Number(a.saleAmount) || 0;
      if (amt > 0) { current.isSale = true; current.revenue += amt; }
      leadMetaMap.set(a.leadId, current);
    });

    // 3. Process Trends by Granularity
    const trendMap = new Map();
    let intervals: Date[] = [];
    
    if (granularity === "week") {
      intervals = eachWeekOfInterval({ start: filterStart, end: filterEnd }, { weekStartsOn: 1 });
    } else if (granularity === "month") {
      intervals = eachMonthOfInterval({ start: filterStart, end: filterEnd });
    } else {
      intervals = eachDayOfInterval({ start: filterStart, end: filterEnd });
    }

    intervals.forEach((dt, idx) => {
      let key = "";
      let label = "";
      if (granularity === "week") {
        key = format(dt, 'yyyy-ww');
        label = `Нед ${format(dt, 'w')}`;
      } else if (granularity === "month") {
        key = format(dt, 'yyyy-MM');
        label = format(dt, 'MMM yyyy', { locale: ru });
      } else {
        key = format(dt, 'yyyy-MM-dd');
        label = format(dt, 'dd.MM');
      }
      trendMap.set(key, { key, period: label, leads: 0, targetLeads: 0, qualLeads: 0, sales: 0, cost: 0, sortKey: dt.getTime() });
    });

    const getPeriodKey = (date: Date) => {
      // Adjust UTC/Local date to Moscow (+3h) before formatting for trend keys
      const mDate = new Date(date.getTime() + 3 * 3600 * 1000);
      if (granularity === "week") return format(startOfWeek(mDate, { weekStartsOn: 1 }), 'yyyy-ww');
      if (granularity === "month") return format(startOfMonth(mDate), 'yyyy-MM');
      return format(mDate, 'yyyy-MM-dd');
    };

    let totalLeadsCount = 0;
    let totalTargetCount = 0;
    let totalQualCount = 0;
    let totalSalesCount = 0;
    let totalRevSum = 0;
    let totalCostSum = 0;
    const campaignStats = new Map<string, { leads: number, targetLeads: number, qualLeads: number, cost: number, rev: number }>();

    dbLeads.forEach(l => {
      if (isHidden(l.utmCampaign, null, l.utmSource)) return;
      const lMeta = leadMetaMap.get(l.id) || { isTarget: false, isQual: false, isSale: false, revenue: 0 };
      
      totalLeadsCount++;
      if (lMeta.isTarget) totalTargetCount++;
      if (lMeta.isQual) totalQualCount++;
      if (lMeta.isSale) totalSalesCount++;
      totalRevSum += lMeta.revenue;

      const key = getPeriodKey(l.date);
      const t = trendMap.get(key);
      if (t) {
        t.leads++;
        if (lMeta.isTarget) t.targetLeads++;
        if (lMeta.isQual) t.qualLeads++;
        if (lMeta.isSale) t.sales++;
      }
      
      const name = resolveName(l.utmCampaign, null, l.utmSource);
      const s = campaignStats.get(name) || { leads: 0, targetLeads: 0, qualLeads: 0, cost: 0, rev: 0 };
      s.leads++;
      if (lMeta.isTarget) s.targetLeads++;
      if (lMeta.isQual) s.qualLeads++;
      s.rev += lMeta.revenue;
      campaignStats.set(name, s);
    });

    dbExpenses.forEach(e => {
      if (isHidden(e.utmCampaign, e.directOrder)) return;
      const c = Number(e.cost) || 0;
      totalCostSum += c;
      const key = getPeriodKey(e.date);
      const t = trendMap.get(key);
      if (t) t.cost += c;
      
      const name = resolveName(e.utmCampaign, e.directOrder);
      const s = campaignStats.get(name) || { leads: 0, targetLeads: 0, qualLeads: 0, cost: 0, rev: 0 };
      s.cost += c;
      campaignStats.set(name, s);
    });

    const sources = await db
      .select({ source: leads.utmSource, count: sql<number>`count(${leads.id})`.mapWith(Number) })
      .from(leads).where(and(...filters)).groupBy(leads.utmSource).orderBy(desc(sql`count`)).limit(10);

    // Filter out "Direct / Unknown" from campaign-level widgets
    const filteredCampaigns = Array.from(campaignStats.entries())
      .filter(([name]) => name !== "Direct / Unknown")
      .map(([name, s]) => ({ 
        name, 
        leads: s.leads, 
        targetLeads: s.targetLeads,
        qualLeads: s.qualLeads,
        cost: s.cost, 
        cpl: s.leads > 0 ? s.cost / s.leads : 0,
        cpt: s.targetLeads > 0 ? s.cost / s.targetLeads : 0,
        cpq: s.qualLeads > 0 ? s.cost / s.qualLeads : 0
      }));

    return NextResponse.json({
      summary: {
        leads: totalLeadsCount,
        targetLeads: totalTargetCount,
        targetConv: totalLeadsCount > 0 ? (totalTargetCount / totalLeadsCount) * 100 : 0,
        qualLeads: totalQualCount,
        qualConv: totalLeadsCount > 0 ? (totalQualCount / totalLeadsCount) * 100 : 0,
        sales: totalSalesCount,
        cost: totalCostSum,
        revenue: totalRevSum,
        cpl: totalLeadsCount > 0 ? totalCostSum / totalLeadsCount : 0,
        cpt: totalTargetCount > 0 ? totalCostSum / totalTargetCount : 0,
        cpq: totalQualCount > 0 ? totalCostSum / totalQualCount : 0,
        romi: totalCostSum > 0 ? ((totalRevSum - totalCostSum) / totalCostSum) * 100 : 0
      },
      trends: Array.from(trendMap.values()).sort((a: any, b: any) => a.sortKey - b.sortKey),
      sources: sources.map(s => ({ name: s.source || "Direct / Internal", value: s.count })),
      
      // Top by Quantities
      topLeads: [...filteredCampaigns].sort((a, b) => b.leads - a.leads).slice(0, 5),
      topTarget: [...filteredCampaigns].sort((a, b) => b.targetLeads - a.targetLeads).slice(0, 5),
      topQual: [...filteredCampaigns].sort((a, b) => b.qualLeads - a.qualLeads).slice(0, 5),
      
      // Top by Efficiency (Strict filter: must have cost > 0 and leads > 0)
      effCpl: filteredCampaigns.filter(c => c.leads > 0 && c.cost > 0).sort((a, b) => a.cpl - b.cpl).slice(0, 5),
      effCpt: filteredCampaigns.filter(c => c.targetLeads > 0 && c.cost > 0).sort((a, b) => a.cpt - b.cpt).slice(0, 5),
      effCpq: filteredCampaigns.filter(c => c.qualLeads > 0 && c.cost > 0).sort((a, b) => a.cpq - b.cpq).slice(0, 5)
    });
  } catch (err) {
    console.error("Dashboard API Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
