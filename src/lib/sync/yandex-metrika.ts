import { db } from "@/db";
import { leads, goalAchievements, trackedGoals, projects, campaignMappings, expenses, syncLogs } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import "dotenv/config";

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
        ['created', 'processed'].includes(r.status)
    );

    if (existing) {
        requestId = existing.request_id;
        console.log(`[Logs API] Found existing request: ${requestId} (Status: ${existing.status})`);
    } else {
        // Create new request (plural logrequests)
        const createUrl = `https://api-metrika.yandex.net/management/v1/counter/${project.yandexCounterId}/logrequests?date1=${dateFrom}&date2=${dateTo}&fields=ym:s:visitID,ym:s:date,ym:s:clientID,ym:s:lastUTMCampaign,ym:s:lastUTMSource,ym:s:goalsID&source=visits`;
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
        const statusRes = await fetch(`${listUrl}/${requestId}`, { 
            headers: { 'Authorization': `Bearer ${project.yandexToken}` } 
        });
        const statusData = await statusRes.json();
        status = statusData.log_request.status;
        console.log(`[Logs API] Polling ${requestId}... Status: ${status}`);
        attempts++;
    }

    if (status !== 'processed') throw new Error("Log request timed out");

    // 3. Download and Parse Parts
    const infoRes = await fetch(`${listUrl}/${requestId}`, { 
        headers: { 'Authorization': `Bearer ${project.yandexToken}` } 
    });
    const infoData = await infoRes.json();
    const parts = infoData.log_request.parts || [];
    
    let totalLeadsCount = 0;
    let totalGoalsCount = 0;

    const projectGoals = await db.select().from(trackedGoals).where(eq(trackedGoals.projectId, projectId));

    for (const part of parts) {
        const downloadUrl = `${listUrl}/${requestId}/part/${part.part_number}/download`;
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

            // Save Lead
            const [lead] = await db.insert(leads).values({
                projectId,
                metrikaVisitId: visitId,
                metrikaClientId: row['ym:s:clientID'],
                date: new Date(row['ym:s:date']),
                utmCampaign: row['ym:s:lastUTMCampaign'],
                utmSource: row['ym:s:lastUTMSource'],
            }).onConflictDoUpdate({
                target: [leads.projectId, leads.metrikaVisitId],
                set: { 
                    utmCampaign: row['ym:s:lastUTMCampaign'],
                    utmSource: row['ym:s:lastUTMSource']
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

        // 1. Prepare URLs
        // Visits metric
        const visitsUrl = `https://api-metrika.yandex.net/stat/v1/data?ids=${project.yandexCounterId}&metrics=ym:s:visits&dimensions=ym:s:date,ym:s:lastUTMCampaign&date1=${dateFrom}&date2=${dateTo}&accuracy=full&limit=10000`;
        
        // Multi-currency cost metrics from Statistics API
        const costMetrics = "ym:ad:RUBAdCost,ym:ad:USDAdCost,ym:ad:EURAdCost,ym:ad:BYNAdCost,ym:ad:KZTAdCost,ym:ad:TRYAdCost";
        let costsUrl = `https://api-metrika.yandex.net/stat/v1/data?ids=${project.yandexCounterId}&metrics=${costMetrics}&dimensions=ym:ad:date,ym:ad:directOrder&date1=${dateFrom}&date2=${dateTo}&accuracy=full&limit=10000`;
        
        // Add direct_client_logins (Crucial for cost data retrieval via Metrika)
        if (project.yandexDirectLogins) {
            costsUrl += `&direct_client_logins=${project.yandexDirectLogins}`;
        }

        console.log(`[Visits Sync] Fetching data for project ${projectId}...`);

        // 2. Parallel Fetch using Promise.all
        const [visitsRes, costsRes] = await Promise.all([
            fetch(visitsUrl, { headers: { 'Authorization': `Bearer ${project.yandexToken}` } }),
            fetch(costsUrl, { headers: { 'Authorization': `Bearer ${project.yandexToken}` } })
        ]);

        if (!visitsRes.ok) throw new Error(`Visits API error: ${await visitsRes.text()}`);
        
        const visitsData = await visitsRes.json();
        let costsData: any = { data: [] };

        if (!costsRes.ok) {
            const errText = await costsRes.text();
            console.warn(`[Visits Sync] Costs API failed (logins might be invalid): ${errText}`);
            // We proceed with visits even if costs fail, as per user specification
        } else {
            costsData = await costsRes.json();
        }

        // 3. Process and Merge Data
        // Map key: "date|campaign_name_or_utm"
        const mergedData = new Map<string, { visits: number, cost: number, utmCampaign: string }>();

        // Map visits (by UTM)
        for (const row of visitsData.data || []) {
            const [dateDim, campDim] = row.dimensions;
            const date = dateDim.name;
            const utm = campDim.name || "";
            const key = `${date}|${utm}`;
            mergedData.set(key, { visits: Math.round(row.metrics[0] || 0), cost: 0, utmCampaign: utm });
        }

        // Map costs (by Direct Order Name)
        for (const row of costsData.data || []) {
            const [dateDim, campDim] = row.dimensions;
            const date = dateDim.name;
            const campName = campDim.name || "";
            
            // Try to find mapping using normalized campaign name
            const mapping = projectMappings.find(m => 
                m.normalizedName === campName.toLowerCase() || 
                m.utmValue === campName
            );
            
            const utm = mapping ? mapping.utmValue : campName;
            const key = `${date}|${utm}`;
            const totalCost = row.metrics.reduce((acc: number, val: number) => acc + (val || 0), 0);
            
            if (mergedData.has(key)) {
                const existing = mergedData.get(key)!;
                existing.cost += totalCost;
            } else {
                mergedData.set(key, { visits: 0, cost: totalCost, utmCampaign: utm });
            }
        }

        // 4. Update Database
        let processedCount = 0;
        for (const [key, data] of mergedData.entries()) {
            const [dateStr, utm] = key.split('|');
            let displayName = utm;
            const mapping = projectMappings.find(m => m.utmValue === utm);
            if (mapping) displayName = mapping.displayName;

            await db.insert(expenses).values({
                projectId,
                date: new Date(dateStr),
                utmCampaign: utm,
                campaignName: displayName,
                visits: data.visits,
                cost: data.cost.toFixed(2),
            }).onConflictDoUpdate({
                target: [expenses.projectId, expenses.date, expenses.campaignId],
                set: { visits: data.visits, cost: data.cost.toFixed(2), utmCampaign: utm, campaignName: displayName }
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
