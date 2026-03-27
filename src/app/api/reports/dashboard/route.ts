import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, expenses, goalAchievements, campaignMappings } from "@/db/schema";
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

  // Normalize dates to start/end of day to avoid missing data due to time components
  const dateFrom = dateFromStr ? new Date(dateFromStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dateTo = dateToStr ? new Date(dateToStr) : new Date();
  
  // Create copies for filters - avoid mutating originals
  const filterStart = new Date(dateFrom);
  filterStart.setHours(0, 0, 0, 0);
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
    const hiddenDisplayNames = new Set(mappings.filter(m => m.isHidden).map(m => m.displayName));

    // Helper to resolve display name (same logic as expenses report)
    const resolveName = (utmCampaign: string | null, directOrder: string | null) => {
      const mapping = mappings.find(m => {
        if (m.utmValue && m.utmValue === utmCampaign) return true;
        if (m.directValue && m.directValue === directOrder) return true;
        const isDbUnknown = !utmCampaign || utmCampaign === "unknown" || !directOrder || directOrder === "unknown";
        if (isDbUnknown) {
          const mapUtmUnknown = !m.utmValue || m.utmValue.toLowerCase() === "unknown";
          if (mapUtmUnknown) return true;
        }
        return false;
      });
      const name = mapping?.displayName || utmCampaign || directOrder || "Unknown";
      return (name.toLowerCase() === "unknown" || !name) ? "Unknown" : name;
    };

    const isHidden = (utmCampaign: string | null, directOrder: string | null) => {
        const name = resolveName(utmCampaign, directOrder);
        const mapping = mappings.find(m => m.displayName === name);
        return mapping?.isHidden || (name === "Unknown" && hiddenDisplayNames.has("Unknown"));
    };

    // 2. Fetch Aggregated Data
    const rawLeads = await db
      .select({
        id: leads.id,
        date: sql<string>`TO_CHAR(${leads.date}, 'YYYY-MM-DD')`.as("d"),
        utmCampaign: leads.utmCampaign,
        projectId: leads.projectId
      })
      .from(leads)
      .where(and(...filters));

    const rawExpenses = await db
      .select({
        date: sql<string>`TO_CHAR(${expenses.date}, 'YYYY-MM-DD')`.as("d"),
        cost: sql<number>`sum(${expenses.cost})`.mapWith(Number),
        utmCampaign: expenses.utmCampaign,
        directOrder: expenses.directOrder
      })
      .from(expenses)
      .where(and(...expFilters))
      .groupBy(sql`d`, expenses.utmCampaign, expenses.directOrder);

    const rawRevenue = await db
      .select({
        sum: sql<number>`sum(CAST(${goalAchievements.saleAmount} AS FLOAT))`.mapWith(Number),
      })
      .from(goalAchievements)
      .innerJoin(leads, eq(goalAchievements.leadId, leads.id))
      .where(and(...filters));

    // 3. Process and Filter (Apply Mappings)
    let totalLeadsCount = 0;
    let totalCostSum = 0;
    const trendMap = new Map();
    const campaignMap = new Map();

    // Process Leads
    rawLeads.forEach(l => {
      if (isHidden(l.utmCampaign, null)) return;
      
      totalLeadsCount++;
      
      // Trends
      const t = trendMap.get(l.date) || { date: l.date, leads: 0, cost: 0 };
      t.leads++;
      trendMap.set(l.date, t);
      
      // Campaign (for Top List)
      const name = resolveName(l.utmCampaign, null);
      campaignMap.set(name, (campaignMap.get(name) || 0) + 1);
    });

    // Process Expenses
    rawExpenses.forEach(e => {
      if (isHidden(e.utmCampaign, e.directOrder)) return;
      
      totalCostSum += e.cost;
      
      // Trends
      const t = trendMap.get(e.date) || { date: e.date, leads: 0, cost: 0 };
      t.cost += e.cost;
      trendMap.set(e.date, t);
    });

    const totalRevenueSum = rawRevenue[0]?.sum || 0;

    // 4. Final Format
    const topCampaigns = Array.from(campaignMap.entries())
      .map(([name, count]) => ({ name, leads: count }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 5);

    // Get Source breakdown (re-fetching for simplicity in grouping)
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
        cost: totalCostSum,
        revenue: totalRevenueSum,
        cpl: totalLeadsCount > 0 ? (totalCostSum / totalLeadsCount) : 0,
        romi: totalCostSum > 0 ? ((totalRevenueSum - totalCostSum) / totalCostSum) * 100 : 0
      },
      trends: Array.from(trendMap.values()).sort((a,b) => a.date.localeCompare(b.date)),
      sources: rawSources.map(s => ({ name: s.source || "Direct / Internal", value: s.count })),
      topCampaigns
    });

  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
