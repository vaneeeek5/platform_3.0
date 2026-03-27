import { NextResponse } from "next/server";
import { db } from "@/db";
import { expenses, leads, goalAchievements, campaignMappings } from "@/db/schema";
import { eq, and, gte, lte, sql, notInArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = parseInt(searchParams.get("projectId") || "");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const raw = searchParams.get("raw") === "true";

  if (!projectId) {
    return NextResponse.json({ error: "No project ID" }, { status: 400 });
  }

  try {
    const filters = [eq(expenses.projectId, projectId)];
    if (dateFrom) filters.push(gte(expenses.date, new Date(dateFrom)));
    if (dateTo) filters.push(lte(expenses.date, new Date(dateTo)));

    const projectMappings = await db.select().from(campaignMappings).where(eq(campaignMappings.projectId, projectId));
    const hiddenCampaignNames = projectMappings.filter((m: any) => m.isHidden).map((m: any) => m.displayName);
    if (hiddenCampaignNames.length > 0) {
      filters.push(notInArray(expenses.campaignName, hiddenCampaignNames));
    }

    if (raw) {
      // Return raw unique terms for mapping UI
      const rawExpenseData = await db
        .select({
          utmCampaign: expenses.utmCampaign,
          directOrder: expenses.directOrder,
          campaignName: expenses.campaignName,
        })
        .from(expenses)
        .where(and(...filters))
        .groupBy(expenses.utmCampaign, expenses.directOrder, expenses.campaignName);
      return NextResponse.json(rawExpenseData);
    }

    // 1. Aggregate Expenses and Visits by mapped CampaignName
    const expenseData = await db
      .select({
        campaignName: expenses.campaignName,
        totalCost: sql<number>`sum(${expenses.cost})`.mapWith(Number),
        totalVisits: sql<number>`sum(${expenses.visits})`.mapWith(Number),
        totalClicks: sql<number>`sum(${expenses.clicks})`.mapWith(Number),
      })
      .from(expenses)
      .where(and(...filters))
      .groupBy(expenses.campaignName);

    // 2. Aggregate Leads
    const leadFilters = [eq(leads.projectId, projectId)];
    if (dateFrom) leadFilters.push(gte(leads.date, new Date(dateFrom)));
    if (dateTo) leadFilters.push(lte(leads.date, new Date(dateTo)));


    const leadDataRaw = await db
      .select({
        id: leads.id,
        utmCampaign: leads.utmCampaign,
      })
      .from(leads)
      .where(and(...leadFilters));

    const leadCountsByCampaign = new Map<string, number>();
    for (const lead of leadDataRaw) {
        let mappedName = lead.utmCampaign || "Unknown";
        const mapping = projectMappings.find(m => m.utmValue === lead.utmCampaign);
        if (mapping) mappedName = mapping.displayName;
        
        leadCountsByCampaign.set(mappedName, (leadCountsByCampaign.get(mappedName) || 0) + 1);
    }

    // 3. Merge Data
    const reportData = new Map<string, any>();
    
    expenseData.forEach(exp => {
      const mappedName = exp.campaignName || "Unknown";
      reportData.set(mappedName, { ...exp, campaignName: mappedName, leadCount: 0 });
    });

    leadCountsByCampaign.forEach((count, mappedName) => {
      if (reportData.has(mappedName)) {
          reportData.get(mappedName).leadCount = count;
      } else {
          reportData.set(mappedName, {
              campaignName: mappedName,
              totalCost: 0, totalVisits: 0, totalClicks: 0,
              leadCount: count
          });
      }
    });

    const finalReport = Array.from(reportData.values()).map(exp => ({
        ...exp,
        cpl: exp.leadCount > 0 ? (exp.totalCost / exp.leadCount) : 0,
        cpc: exp.totalClicks > 0 ? (exp.totalCost / exp.totalClicks) : 0,
        conversion: exp.totalVisits > 0 ? (exp.leadCount / exp.totalVisits) * 100 : 0
    }));

    return NextResponse.json(finalReport);
  } catch (error) {
    console.error("Failed to fetch expense report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
