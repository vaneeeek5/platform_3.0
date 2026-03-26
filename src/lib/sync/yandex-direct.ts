import { db } from "@/db";
import { expenses, campaignMappings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function syncDirectExpenses(projectId: number, dateFromStr?: string, dateToStr?: string) {
  const project = await db.query.projects.findFirst({
    where: (projects, { eq }) => eq(projects.id, projectId),
  });

  if (!project || !project.yandexToken) {
    return { error: "Missing Yandex credentials" };
  }

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  let dateTo = dateToStr ? new Date(dateToStr).toISOString().split('T')[0] : yesterday;
  let dateFrom = dateFromStr ? new Date(dateFromStr).toISOString().split('T')[0] : new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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

  try {
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
        console.error("Direct API Error:", error);
        return { error: `Direct API Error: ${error}` };
    }

    const tsv = await response.text();
    const rows = tsv.split('\n');
    
    // Find where the actual data starts (Yandex TSV has some meta header lines)
    const dataStartIdx = rows.findIndex(r => r.includes('Date\tCampaignName'));
    if (dataStartIdx === -1) return { skipped: true, reason: "Invalid TSV format" };

    const dataRows = rows.slice(dataStartIdx + 1);

    let count = 0;
    for (const row of dataRows) {
        if (!row.trim() || row.startsWith('Total')) continue;
        const [date, campaignName, campaignId, cost, clicks, impressions] = row.split('\t');
        
        if (!date || !campaignId) continue;

        // Apply Mapping
        let utmCampaign = campaignId;
        const mapping = projectMappings.find(m => m.utmValue === campaignId || m.utmValue === campaignName);
        if (mapping) {
            utmCampaign = mapping.displayName;
        }

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

    return { success: true, count };
  } catch (e: any) {
    console.error("Direct Sync Exception:", e);
    return { error: e.message };
  }
}
