import { NextResponse } from "next/server";
import { db } from "@/db";
import { expenses, leads, goalAchievements } from "@/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
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

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  try {
    const filters = [eq(expenses.projectId, projectId)];
    if (dateFrom) filters.push(gte(expenses.date, new Date(dateFrom)));
    if (dateTo) filters.push(lte(expenses.date, new Date(dateTo)));

    // 1. Aggregate Expenses and Visits
    const expenseData = await db
      .select({
        utmCampaign: expenses.utmCampaign,
        campaignName: expenses.campaignName,
        totalCost: sql<number>`sum(${expenses.cost})`.mapWith(Number),
        totalVisits: sql<number>`sum(${expenses.visits})`.mapWith(Number),
        totalClicks: sql<number>`sum(${expenses.clicks})`.mapWith(Number),
      })
      .from(expenses)
      .where(and(...filters))
      .groupBy(expenses.utmCampaign, expenses.campaignName);

    // 2. Aggregate Leads
    const leadFilters = [eq(leads.projectId, projectId)];
    if (dateFrom) leadFilters.push(gte(leads.date, new Date(dateFrom)));
    if (dateTo) leadFilters.push(lte(leads.date, new Date(dateTo)));

    const leadData = await db
      .select({
        utmCampaign: leads.utmCampaign,
        leadCount: sql<number>`count(distinct ${leads.id})`.mapWith(Number),
      })
      .from(leads)
      .where(and(...leadFilters))
      .groupBy(leads.utmCampaign);

    // 3. Merge Data
    const report = expenseData.map(exp => {
      const leads = leadData.find(l => l.utmCampaign === exp.utmCampaign);
      const leadCount = leads?.leadCount || 0;
      
      return {
        ...exp,
        leadCount,
        cpl: leadCount > 0 ? (exp.totalCost / leadCount) : 0,
        cpc: exp.totalClicks > 0 ? (exp.totalCost / exp.totalClicks) : 0,
        conversion: exp.totalVisits > 0 ? (leadCount / exp.totalVisits) * 100 : 0
      };
    });

    // Handle campaigns that have leads but no expenses recorded
    leadData.forEach(l => {
        if (!report.find(r => r.utmCampaign === l.utmCampaign)) {
            report.push({
                utmCampaign: l.utmCampaign || "Unknown",
                campaignName: l.utmCampaign || "Unknown",
                totalCost: 0,
                totalVisits: 0,
                totalClicks: 0,
                leadCount: l.leadCount,
                cpl: 0,
                cpc: 0,
                conversion: 0
            });
        }
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error("Failed to fetch expense report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
