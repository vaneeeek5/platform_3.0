import { db } from "@/db";
import { leads, goalAchievements, trackedGoals, projects, campaignMappings, expenses, syncLogs } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import "dotenv/config";
import { parseFlexibleDate } from "../date-utils";

// --- LOGS API SYNC (LEADS) ---
export async function syncMetrikaLeads(projectId: number, dateFromStr?: string, dateToStr?: string) {
  const [logEntry] = await db.insert(syncLogs).values({
    projectId,
    type: "METRIKA_LEADS",
    status: "RUNNING",
    startedAt: new Date(),
  }).returning();

  try {
    const project = await db.query.projects.findFirst({
      where: (projects, { eq }) => eq(projects.id, projectId),
    });

    if (!project || !project.yandexToken || !project.yandexCounterId) {
      throw new Error("Missing Yandex Metrika credentials for project");
    }

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    let dateTo = dateToStr ? new Date(dateToStr).toISOString().split('T')[0] : yesterday;
    let dateFrom = dateFromStr ? new Date(dateFromStr).toISOString().split('T')[0] : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`[Logs API] Starting sync for ${project.yandexCounterId}: ${dateFrom} - ${dateTo}`);

    // 1. Check for existing requests to avoid 400 "already exists"
    const listUrl = `https://api-metrika.yandex.net/management/v1/counter/${project.yandexCounterId}/logrequests`;
    const listRes = await fetch(listUrl, { headers: { 'Authorization': `Bearer ${project.yandexToken}` } });
    if (!listRes.ok) throw new Error(`Failed to list log requests: ${await listRes.text()}`);
    const { requests = [] } = await listRes.json();
    
    let requestId: string | null = null;
    const existing = requests.find((r: any) => 
        r.date1 === dateFrom && 
        r.date2 === dateTo && 
        ['created', 'processed'].includes(r.status) &&
        (!r.fields || r.fields.includes('ym:s:dateTime')) // Игнорируем старые кэши без времени
    );

    if (existing) {
        requestId = existing.request_id;
        console.log(`[Logs API] Found existing request: ${requestId} (Status: ${existing.status})`);
    } else {
        // Create new request (plural logrequests)
        const createUrl = `https://api-metrika.yandex.net/management/v1/counter/${project.yandexCounterId}/logrequests?date1=${dateFrom}&date2=${dateTo}&fields=ym:s:visitID,ym:s:dateTime,ym:s:clientID,ym:s:lastUTMCampaign,ym:s:lastUTMSource,ym:s:goalsID&source=visits`;
        const createRes = await fetch(createUrl, { 
            method: 'POST',
            headers: { 'Authorization': `Bearer ${project.yandexToken}` } 
        });
        if (!createRes.ok) throw new Error(`Failed to create log request: ${await createRes.text()}`);
        const createData = await createRes.json();
        requestId = createData.log_request.request_id;
        console.log(`[Logs API] Request created: ${requestId}`);
    }

    // 2. Poll until processed
    let status = 'created';
    let attempts = 0;
    while (status !== 'processed' && attempts < 60) {
        await new Promise(r => setTimeout(r, 5000));
        const statusRes = await fetch(`https://api-metrika.yandex.net/management/v1/counter/${project.yandexCounterId}/logrequest/${requestId}`, { 
            headers: { 'Authorization': `Bearer ${project.yandexToken}` } 
        });
        if (!statusRes.ok) throw new Error(`Status check failed: ${await statusRes.text()}`);
        const statusData = await statusRes.json();
        status = statusData.log_request.status;
        console.log(`[Logs API] Polling ${requestId}... Status: ${status}`);
        attempts++;
    }

    if (status !== 'processed') throw new Error("Log request timed out");

    // 3. Download and Parse Parts
    const infoRes = await fetch(`https://api-metrika.yandex.net/management/v1/counter/${project.yandexCounterId}/logrequest/${requestId}`, { 
        headers: { 'Authorization': `Bearer ${project.yandexToken}` } 
    });
    const infoData = await infoRes.json();
    const parts = infoData.log_request.parts || [];
    
    let totalLeadsCount = 0;
    let totalGoalsCount = 0;

    const projectGoals = await db.select().from(trackedGoals).where(eq(trackedGoals.projectId, projectId));

    for (const part of parts) {
        const downloadUrl = `https://api-metrika.yandex.net/management/v1/counter/${project.yandexCounterId}/logrequest/${requestId}/part/${part.part_number}/download`;
        const downloadRes = await fetch(downloadUrl, { 
            headers: { 'Authorization': `Bearer ${project.yandexToken}` } 
        });
        const tsv = await downloadRes.text();
        const lines = tsv.split('\n').filter(l => l.trim());
        const headers = lines[0].split('\t');
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split('\t');
            const row: any = {};
            headers.forEach((h, idx) => row[h] = values[idx]);

            const visitId = row['ym:s:visitID'];
            const goalsHit = JSON.parse(row['ym:s:goalsID'] || '[]');
            
            // Only care about visits that hit our tracked goals
            const matchedGoals = projectGoals.filter(g => goalsHit.includes(parseInt(g.goalId)));
            if (matchedGoals.length === 0) continue;

            const utmSource = row['ym:s:lastUTMSource'] || '';
            const utmCampaign = row['ym:s:lastUTMCampaign'] || '';

            // Filter by allowed UTM sources if configured
            if (project.yandexUtmsAllowed && project.yandexUtmsAllowed.trim().length > 0) {
               const allowed = project.yandexUtmsAllowed.split(',').map(s => s.trim().toLowerCase());
               if (!allowed.includes(utmSource.toLowerCase())) {
                   continue; // Skip this lead
               }
            }

            // Save Lead
            const leadDate = parseFlexibleDate(row['ym:s:dateTime'] || row['ym:s:datetime'] || row['ym:s:date']);

            const [lead] = await db.insert(leads).values({
                projectId,
                metrikaVisitId: visitId,
                metrikaClientId: row['ym:s:clientID'] || row['ym:s:client_id'] || null,
                date: leadDate,
                utmCampaign,
                utmSource,
            }).onConflictDoUpdate({
                target: [leads.projectId, leads.metrikaVisitId],
                set: { 
                    utmCampaign,
                    utmSource,
                    date: leadDate
                }
            }).returning();

            // Save Goal Achievements
            for (const goal of matchedGoals) {
                await db.insert(goalAchievements).values({
                    leadId: lead.id,
                    goalId: goal.goalId,
                    goalName: goal.goalName,
                    targetStatusId: goal.targetStatusId,
                    qualificationStatusId: goal.qualificationStatusId,
                }).onConflictDoNothing();
                totalGoalsCount++;
            }
            totalLeadsCount++;
        }
    }

    await db.update(syncLogs).set({ 
        status: "SUCCESS", 
        recordsCreated: totalLeadsCount,
        finishedAt: new Date() 
    }).where(eq(syncLogs.id, logEntry.id));

    return { success: true, leadsCount: totalLeadsCount, goalsCount: totalGoalsCount };

  } catch (error: any) {
    const errMsg = error.cause?.message ? `${error.message}: ${error.cause.message}` : error.message;
    console.error(`[Logs API Error]`, errMsg);
    await db.update(syncLogs).set({ status: "ERROR", error: errMsg, finishedAt: new Date() }).where(eq(syncLogs.id, logEntry.id));
    return { error: errMsg };
  }
}

// --- VISITS & EXPENSES SYNC ---
export async function syncMetrikaVisits(projectId: number, dateFromStr?: string, dateToStr?: string) {
    const [logEntry] = await db.insert(syncLogs).values({
        projectId,
        type: "METRIKA_EXPENSES",
        status: "RUNNING",
        startedAt: new Date(),
    }).returning();

    try {
        const project = await db.query.projects.findFirst({
            where: (projects, { eq }) => eq(projects.id, projectId),
        });
        if (!project || !project.yandexToken || !project.yandexCounterId) throw new Error("Missing credentials");

        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        let dateTo = dateToStr ? new Date(dateToStr).toISOString().split('T')[0] : yesterday;
        let dateFrom = dateFromStr ? new Date(dateFromStr).toISOString().split('T')[0] : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const projectMappings = await db.select().from(campaignMappings).where(eq(campaignMappings.projectId, projectId));

        // Visits use UTMCampaign
        const visitsUrl = `https://api-metrika.yandex.net/stat/v1/data?ids=${project.yandexCounterId}&metrics=ym:s:visits&dimensions=ym:s:date,ym:s:lastUTMCampaign&date1=${dateFrom}&date2=${dateTo}&accuracy=full&limit=10000`;
        
        // Costs use Direct Order
        const costMetrics = "ym:ad:RUBAdCost,ym:ad:USDAdCost,ym:ad:EURAdCost,ym:ad:BYNAdCost,ym:ad:KZTAdCost,ym:ad:TRYAdCost";
        let costsUrl = `https://api-metrika.yandex.net/stat/v1/data?ids=${project.yandexCounterId}&metrics=${costMetrics}&dimensions=ym:ad:date,ym:ad:directOrder&date1=${dateFrom}&date2=${dateTo}&accuracy=full&limit=10000`;
        
        if (project.yandexDirectLogins) {
            costsUrl += `&direct_client_logins=${project.yandexDirectLogins}`;
        }

        console.log(`[Visits Sync] Fetching data for project ${projectId}...`);

        const [visitsRes, costsRes] = await Promise.all([
            fetch(visitsUrl, { headers: { 'Authorization': `Bearer ${project.yandexToken}` } }),
            fetch(costsUrl, { headers: { 'Authorization': `Bearer ${project.yandexToken}` } })
        ]);

        if (!visitsRes.ok) throw new Error(`Visits API error: ${await visitsRes.text()}`);
        
        const visitsData = await visitsRes.json();
        let costsData: any = { data: [] };

        if (!costsRes.ok) {
            console.warn(`[Visits Sync] Costs API failed: ${await costsRes.text()}`);
        } else {
            costsData = await costsRes.json();
        }

        // Merge key: mapping ID if matched, else raw UTM/Direct
        type MergedRow = { visits: number, cost: number, utmCampaign: string, directOrder: string, campaignName: string };
        const mergedData = new Map<string, MergedRow>();

        // Process visits
        for (const row of visitsData.data || []) {
            const [dateDim, utmDim] = row.dimensions;
            const date = dateDim.name;
            const utm = utmDim.name || "";
            const visits = Math.round(row.metrics[0] || 0);
            
            const mapping = projectMappings.find(m => m.utmValue === utm);
            const key = mapping ? `${date}|map_${mapping.id}` : `${date}|utm_${utm}`;
            const displayName = mapping?.displayName || utm;

            if (mergedData.has(key)) {
                const existing = mergedData.get(key)!;
                existing.visits += visits;
                if (!existing.utmCampaign && utm) existing.utmCampaign = utm;
            } else {
                mergedData.set(key, { visits, cost: 0, utmCampaign: utm, directOrder: mapping?.directValue || "", campaignName: displayName });
            }
        }

        // Process costs
        for (const row of costsData.data || []) {
            const [dateDim, orderDim] = row.dimensions;
            const date = dateDim.name;
            const orderName = orderDim.name || "";
            // Extract primary currency cost (metrics[0] is RUBAdCost based on our API request)
            // Do not reduce/sum the array because Metrika returns the SAME cost converted into all requested currencies!
            const totalCost = row.metrics[0] || row.metrics.find((m: number | null) => m !== null && m > 0) || 0;
            
            const mapping = projectMappings.find(m => m.directValue === orderName);
            const key = mapping ? `${date}|map_${mapping.id}` : `${date}|dir_${orderName}`;
            const displayName = mapping?.displayName || orderName;

            if (mergedData.has(key)) {
                const existing = mergedData.get(key)!;
                existing.cost += totalCost;
                if (!existing.directOrder && orderName) existing.directOrder = orderName;
            } else {
                mergedData.set(key, { visits: 0, cost: totalCost, utmCampaign: mapping?.utmValue || "", directOrder: orderName, campaignName: displayName });
            }
        }

        // Save to DB
        let processedCount = 0;
        const keys = Array.from(mergedData.keys());

        // Delete existing expenses for this project in the synced date range to prevent orphaned duplicate rows when mappings change
        await db.delete(expenses).where(
            and(
                eq(expenses.projectId, projectId),
                gte(expenses.date, new Date(dateFrom)),
                lte(expenses.date, new Date(dateTo))
            )
        );

        for (const [, data] of mergedData.entries()) {
            const [dateStr] = keys[processedCount].split('|');
            const fallbackUtm = data.utmCampaign || data.directOrder || "unknown"; // Ensures conflict target never fails

            await db.insert(expenses).values({
                projectId,
                date: new Date(dateStr),
                utmCampaign: fallbackUtm,
                directOrder: data.directOrder || null,
                campaignName: data.campaignName || fallbackUtm,
                visits: data.visits,
                cost: data.cost.toFixed(2),
            }).onConflictDoUpdate({
                target: [expenses.projectId, expenses.date, expenses.utmCampaign],
                set: { 
                    visits: data.visits, 
                    cost: data.cost.toFixed(2), 
                    directOrder: data.directOrder || null,
                    campaignName: data.campaignName || fallbackUtm 
                }
            }).catch(() => {
                // Fallback: if conflict logic fails, ignore for this row
            });
            processedCount++;
        }

        await db.update(syncLogs).set({ 
            status: "SUCCESS", 
            recordsProcessed: processedCount,
            finishedAt: new Date() 
        }).where(eq(syncLogs.id, logEntry.id));

        return { success: true, count: processedCount };
    } catch (error: any) {
        const errMsg = error.cause?.message ? `${error.message}: ${error.cause.message}` : error.message;
        console.error(`[Visits Sync Error]`, errMsg);
        await db.update(syncLogs).set({ status: "ERROR", error: errMsg, finishedAt: new Date() }).where(eq(syncLogs.id, logEntry.id));
        return { error: errMsg };
    }
}
