import { NextResponse } from "next/server";
import { db } from "@/db";
import { expenses, leads, goalAchievements, campaignMappings, projectLinks } from "@/db/schema";
import { eq, and, gte, lte, sql, notInArray } from "drizzle-orm";
import { getMoscowDateRange } from "@/lib/date-utils";
import { getSession } from "@/lib/auth";
import { verifyProjectAccess } from "@/lib/permissions";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectIdStr = searchParams.get("projectId");
  const projectId = projectIdStr ? parseInt(projectIdStr) : null;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const raw = searchParams.get("raw") === "true";

  if (!projectId) {
    return NextResponse.json({ error: "No project ID" }, { status: 400 });
  }

  // RBAC Check
  const hasAccess = await verifyProjectAccess(session.id, session.role, projectId, 'canViewExpenses');
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden: No access to expenses for this project" }, { status: 403 });
  }

  try {
    const filters = [eq(expenses.projectId, projectId)];
    if (dateFrom) {
        const range = getMoscowDateRange(dateFrom);
        if (range) filters.push(gte(expenses.date, range.start));
    }
    if (dateTo) {
        const range = getMoscowDateRange(dateTo);
        if (range) filters.push(lte(expenses.date, range.end));
    }

    // Fetch mappings once to resolve names in real-time
    const projectMappings = await db.select().from(campaignMappings).where(eq(campaignMappings.projectId, projectId));
    const hiddenDisplayNames = new Set(projectMappings.filter(m => m.isHidden).map(m => m.displayName));

    if (raw) {
      // Return raw unique terms for mapping UI (still needs raw data)
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

    // Aggregated report
    const expenseData = await db
      .select({
        utmCampaign: expenses.utmCampaign,
        directOrder: expenses.directOrder,
        campaignName: expenses.campaignName,
        totalCost: sql<number>`sum(${expenses.cost})`.mapWith(Number),
        totalVisits: sql<number>`sum(${expenses.visits})`.mapWith(Number),
        totalClicks: sql<number>`sum(${expenses.clicks})`.mapWith(Number),
      })
      .from(expenses)
      .where(and(...filters))
      .groupBy(expenses.utmCampaign, expenses.directOrder, expenses.campaignName);

    const leadData = await db
      .select({
        utmCampaign: leads.utmCampaign,
        count: sql<number>`count(${leads.id})`.mapWith(Number),
      })
      .from(leads)
      .where(and(
        eq(leads.projectId, projectId), 
        dateFrom ? gte(leads.date, getMoscowDateRange(dateFrom)!.start) : undefined, 
        dateTo ? lte(leads.date, getMoscowDateRange(dateTo)!.end) : undefined
      ))
      .groupBy(leads.utmCampaign);

    const reportData = new Map<string, any>();

    // Step 1: Process Expense Data and Resolve Names
    expenseData.forEach(exp => {
      // Find mapping: check UTM first, then Direct Order
      const mapping = projectMappings.find(m => {
        const utmMatch = m.utmValue && m.utmValue === exp.utmCampaign;
        const directMatch = m.directValue && m.directValue === exp.directOrder;
        if (utmMatch || directMatch) return true;
        
        // Special case: if DB data is "unknown"/empty, match it if mapping explicitly says "unknown" OR is empty
        const isDbUnknown = !exp.utmCampaign || exp.utmCampaign === "unknown" || !exp.directOrder || exp.directOrder === "unknown";
        if (isDbUnknown) {
           const mapUtmUnknown = !m.utmValue || m.utmValue.toLowerCase() === "unknown";
           const mapDirectUnknown = !m.directValue || m.directValue.toLowerCase() === "unknown";
           if (mapUtmUnknown || mapDirectUnknown) return true;
        }
        return false;
      });
      
      const rawName = exp.campaignName || exp.utmCampaign || "";
      const displayName = mapping?.displayName || rawName || "Unknown";
      
      // Standardize to "Unknown" if still empty or literally "unknown"
      const finalDisplayName = (displayName.toLowerCase() === "unknown" || !displayName) ? "Unknown" : displayName;

      // SKIP HIDDEN ROWS
      if (mapping?.isHidden || (finalDisplayName === "Unknown" && hiddenDisplayNames.has("Unknown"))) {
        return;
      }

      if (reportData.has(finalDisplayName)) {
        const existing = reportData.get(finalDisplayName);
        existing.totalCost += exp.totalCost;
        existing.totalVisits += exp.totalVisits;
        existing.totalClicks += exp.totalClicks;
      } else {
        reportData.set(finalDisplayName, {
          campaignName: finalDisplayName,
          totalCost: exp.totalCost,
          totalVisits: exp.totalVisits,
          totalClicks: exp.totalClicks,
          leadCount: 0,
        });
      }
    });

    // Step 2: Map Lead Data to Resolved Names
    leadData.forEach(lead => {
      const mapping = projectMappings.find(m => {
        if (m.utmValue && m.utmValue === lead.utmCampaign) return true;
        const isDbUnknown = !lead.utmCampaign || lead.utmCampaign === "unknown";
        if (isDbUnknown) {
           const mapUtmUnknown = !m.utmValue || m.utmValue.toLowerCase() === "unknown";
           if (mapUtmUnknown) return true;
        }
        return false;
      });

      const displayName = mapping?.displayName || lead.utmCampaign || "Unknown";
      const finalDisplayName = (displayName.toLowerCase() === "unknown" || !displayName) ? "Unknown" : displayName;
      
      // SKIP HIDDEN ROWS
      if (mapping?.isHidden || (finalDisplayName === "Unknown" && hiddenDisplayNames.has("Unknown"))) {
        return;
      }

      const row = reportData.get(finalDisplayName);
      if (row) {
        row.leadCount += lead.count;
      } else {
        reportData.set(finalDisplayName, {
          campaignName: finalDisplayName,
          totalCost: 0,
          totalVisits: 0,
          totalClicks: 0,
          leadCount: lead.count,
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
