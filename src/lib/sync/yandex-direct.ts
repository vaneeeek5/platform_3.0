import { db } from "@/db";
import { expenses, campaignMappings, syncLogs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function syncDirectExpenses(projectId: number, dateFromStr?: string, dateToStr?: string) {
  // 0. Create Log Entry
  const [logEntry] = await db.insert(syncLogs).values({
    projectId,
    type: "METRIKA_EXPENSES", // Using this for both Metrika costs and Direct
    status: "RUNNING",
    startedAt: new Date(),
  }).returning();

  try {
    const project = await db.query.projects.findFirst({
      where: (projects, { eq }) => eq(projects.id, projectId),
    });

    if (!project || !project.yandexToken) {
        throw new Error("Missing Yandex credentials");
    }

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    let dateTo = dateToStr ? new Date(dateToStr).toISOString().split('T')[0] : yesterday;
    let dateFrom = dateFromStr ? new Date(dateFromStr).toISOString().split('T')[0] : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Cap to yesterday for consistency
    if (dateTo > yesterday) dateTo = yesterday;
    if (dateFrom > dateTo) dateFrom = dateTo;

    const projectMappings = await db.select().from(campaignMappings).where(eq(campaignMappings.projectId, projectId));

    const reportDefinition = {
        params: {
            SelectionCriteria: {
                DateFrom: dateFrom,
                DateTo: dateTo
            },
            FieldNames: ["Date", "CampaignName", "CampaignId", "Cost", "Clicks", "Impressions"],
            ReportName: `Project_${projectId}_Expenses_${Date.now()}`,
            ReportType: "CAMPAIGN_PERFORMANCE_REPORT",
            DateRangeType: "CUSTOM_DATE",
            Format: "TSV",
            IncludeVAT: "YES",
            IncludeDiscount: "NO"
        }
    };

    const response = await fetch('https://api.direct.yandex.com/json/v5/reports', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${project.yandexToken}`,
        'Accept-Language': 'ru',
        'Content-Type': 'application/json',
        'returnMoneyInMicros': 'false'
      },
      body: JSON.stringify(reportDefinition)
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Direct API Error: ${error}`);
    }

    const tsv = await response.text();
    const rows = tsv.split('\n');
    const dataStartIdx = rows.findIndex(r => r.includes('Date\tCampaignName'));
    if (dataStartIdx === -1) {
        await db.update(syncLogs).set({ status: "SUCCESS", error: "No data in report", finishedAt: new Date() }).where(eq(syncLogs.id, logEntry.id));
        return { skipped: true, reason: "Invalid TSV / No data" };
    }

    const dataRows = rows.slice(dataStartIdx + 1);

    let count = 0;
    for (const row of dataRows) {
        if (!row.trim() || row.startsWith('Total')) continue;
        const [date, campaignName, campaignId, cost, clicks, impressions] = row.split('\t');
        
        if (!date || !campaignId) continue;

        let utmCampaign = campaignId;
        const mapping = projectMappings.find(m => m.utmValue === campaignId || m.utmValue === campaignName);
        if (mapping) utmCampaign = mapping.displayName;

        await db.insert(expenses).values({
          projectId,
          date: new Date(date),
          campaignId: campaignId,
          campaignName: campaignName,
          utmCampaign: utmCampaign,
          cost: cost ? cost.replace(',', '.') : "0",
          clicks: clicks ? parseInt(clicks) : 0,
          impressions: impressions ? parseInt(impressions) : 0,
        }).onConflictDoUpdate({
            target: [expenses.projectId, expenses.date, expenses.campaignId],
            set: {
                cost: cost ? cost.replace(',', '.') : "0",
                clicks: clicks ? parseInt(clicks) : 0,
                impressions: impressions ? parseInt(impressions) : 0,
                campaignName: campaignName,
                utmCampaign: utmCampaign
            }
        });
        count++;
    }

    await db.update(syncLogs).set({ 
        status: "SUCCESS", 
        recordsProcessed: count,
        finishedAt: new Date() 
    }).where(eq(syncLogs.id, logEntry.id));

    return { success: true, count };
  } catch (error: any) {
    console.error("Direct Sync Exception:", error);
    await db.update(syncLogs).set({ status: "ERROR", error: error.message, finishedAt: new Date() }).where(eq(syncLogs.id, logEntry.id));
    return { error: error.message };
  }
}
