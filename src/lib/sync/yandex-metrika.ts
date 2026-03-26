import { db } from "@/db";
import { leads, goalAchievements, trackedGoals, campaignMappings, expenses, syncLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function syncMetrikaLeads(projectId: number, dateFromStr?: string, dateToStr?: string) {
  // 0. Create Log Entry
  const [logEntry] = await db.insert(syncLogs).values({
    projectId,
    type: "METRIKA_LEADS",
    status: "RUNNING",
    startedAt: new Date(),
  }).returning();

  const project = await db.query.projects.findFirst({
    where: (projects, { eq }) => eq(projects.id, projectId),
  });

  if (!project || !project.yandexToken || !project.yandexCounterId) {
    const err = "Missing Yandex credentials";
    await db.update(syncLogs).set({ status: "ERROR", error: err, finishedAt: new Date() }).where(eq(syncLogs.id, logEntry.id));
    return { error: err };
  }

  const projectTrackedGoals = await db.select().from(trackedGoals).where(eq(trackedGoals.projectId, projectId));
  if (projectTrackedGoals.length === 0) {
    const err = "No tracked goals";
    await db.update(syncLogs).set({ status: "SUCCESS", error: err, finishedAt: new Date() }).where(eq(syncLogs.id, logEntry.id));
    return { skipped: true, reason: err };
  }

  const projectMappings = await db.select().from(campaignMappings).where(eq(campaignMappings.projectId, projectId));

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  let dateTo = dateToStr ? new Date(dateToStr).toISOString().split('T')[0] : yesterday;
  let dateFrom = dateFromStr ? new Date(dateFromStr).toISOString().split('T')[0] : new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  if (dateTo > yesterday) dateTo = yesterday;
  if (dateFrom > dateTo) dateFrom = dateTo;

  console.log(`[Logs API] Starting sync for ${project.yandexCounterId}: ${dateFrom} - ${dateTo}`);

  try {
    // 1. Check for existing Log Requests
    let requestId: string | null = null;
    const existingRes = await fetch(`https://api-metrika.yandex.net/management/v1/counter/${project.yandexCounterId}/logrequests`, {
        headers: { 'Authorization': `OAuth ${project.yandexToken}` }
    });
    if (existingRes.ok) {
        const { requests } = await existingRes.json();
        const active = requests.find((r: any) => 
            (r.status === 'created' || r.status === 'processing') && 
            r.date1 === dateFrom && r.date2 === dateTo
        );
        if (active) {
            requestId = active.request_id;
            console.log(`[Logs API] Using existing request: ${requestId}`);
        }
    }

    if (!requestId) {
        // 2. Create Log Request
        const fields = "ym:s:visitID,ym:s:dateTime,ym:s:clientID,ym:s:lastUTMCampaign,ym:s:lastUTMSource,ym:s:goalsID";
        const requestUrl = `https://api-metrika.yandex.net/management/v1/counter/${project.yandexCounterId}/logrequests?date1=${dateFrom}&date2=${dateTo}&fields=${fields}&source=visits`;
        
        const requestRes = await fetch(requestUrl, {
          method: 'POST',
          headers: { 'Authorization': `OAuth ${project.yandexToken}` }
        });

        if (!requestRes.ok) {
            const err = await requestRes.text();
            throw new Error(`Failed to create log request: ${err}`);
        }

        const { log_request } = await requestRes.json();
        requestId = log_request.request_id;
        console.log(`[Logs API] Request created: ${requestId}`);
    }

    // 3. Poll for completion
    let status = 'created';
    let parts: any[] = [];
    let attempts = 0;
    
    while (status !== 'processed' && attempts < 40) {
        const pollRes = await fetch(`https://api-metrika.yandex.net/management/v1/counter/${project.yandexCounterId}/logrequest/${requestId}`, {
            headers: { 'Authorization': `OAuth ${project.yandexToken}` }
        });
        if (!pollRes.ok) throw new Error(`Polling failed: ${await pollRes.text()}`);
        const pollData = await pollRes.json();
        status = pollData.log_request.status;
        parts = pollData.log_request.parts || [];
        attempts++;
        console.log(`[Logs API] Polling ${requestId}... Status: ${status}`);

        if (status === 'processed') break;
        if (status === 'canceled' || status === 'cleaning_failed') throw new Error(`Log request failed: ${status}`);
        
        await new Promise(r => setTimeout(r, 5000));
    }

    if (status !== 'processed') throw new Error("Log request timed out");

    // 4. Download and Parse
    let totalLeadsCount = 0;
    let totalGoalsCount = 0;

    for (const part of parts) {
        const partNumber = part.part_number;
        const downloadUrl = `https://api-metrika.yandex.net/management/v1/counter/${project.yandexCounterId}/logrequest/${requestId}/part/${partNumber}/download`;
        const downloadRes = await fetch(downloadUrl, { headers: { 'Authorization': `OAuth ${project.yandexToken}` } });
        if (!downloadRes.ok) throw new Error(`Download failed: ${await downloadRes.text()}`);
        
        const tsvOutput = await downloadRes.text();
        const rows = tsvOutput.split('\n');
        if (rows.length < 2) continue;
        const header = rows[0].split('\t');
        
        const idxVisitID = header.indexOf('ym:s:visitID');
        const idxClientID = header.indexOf('ym:s:clientID');
        const idxDateTime = header.indexOf('ym:s:dateTime');
        const idxCampaign = header.indexOf('ym:s:lastUTMCampaign');
        const idxSource = header.indexOf('ym:s:lastUTMSource');
        const idxGoals = header.indexOf('ym:s:goalsID');

        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split('\t');
            if (cols.length < header.length) continue;

            const visitId = cols[idxVisitID];
            const clientId = cols[idxClientID];
            const dateTime = cols[idxDateTime];
            let utmCampaign = cols[idxCampaign]?.replace(/'/g, '') || "";
            const utmSource = cols[idxSource]?.replace(/'/g, '') || "";
            const rawGoalIds = cols[idxGoals]; 

            if (!rawGoalIds || rawGoalIds === "[]" || rawGoalIds === "''") continue;
            
            const achievedStrings = rawGoalIds.replace('[','').replace(']','').split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean);
            const trackedAchieved = achievedStrings.filter(id => projectTrackedGoals.some(tg => tg.goalId.toString() === id.toString()));

            if (trackedAchieved.length === 0) continue;

            const mapping = projectMappings.find(m => m.utmValue === utmCampaign);
            if (mapping) utmCampaign = mapping.displayName || utmCampaign;

            const [lead] = await db.insert(leads).values({
                projectId,
                metrikaVisitId: visitId,
                metrikaClientId: clientId,
                date: new Date(dateTime),
                utmCampaign,
                utmSource,
            }).onConflictDoUpdate({
                target: [leads.projectId, leads.metrikaVisitId],
                set: { utmCampaign, utmSource }
            }).returning();

            for (const gId of trackedAchieved) {
                const tg = projectTrackedGoals.find(g => g.goalId.toString() === gId.toString());
                if (!tg) continue;
                await db.insert(goalAchievements).values({
                    leadId: lead.id,
                    goalId: gId.toString(),
                    goalName: tg.goalName,
                    targetStatusId: tg.targetStatusId,
                    qualificationStatusId: tg.qualificationStatusId
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

        const url = `https://api-metrika.yandex.net/stat/v1/data?ids=${project.yandexCounterId}&metrics=ym:s:visits&dimensions=ym:s:date,ym:s:lastUTMCampaign&date1=${dateFrom}&date2=${dateTo}&accuracy=full&limit=1000`;
        const response = await fetch(url, { headers: { 'Authorization': `OAuth ${project.yandexToken}` } });
        if (!response.ok) throw new Error(`Metrika API Error: ${await response.text()}`);

        const data = await response.json();
        const rows = data.data || [];

        for (const row of rows) {
            const [dateDim, campaignDim] = row.dimensions;
            const date = dateDim.name;
            let utmCampaign = campaignDim.name || "";
            const visits = row.metrics[0];

            const mapping = projectMappings.find(m => m.utmValue === utmCampaign);
            if (mapping) utmCampaign = mapping.displayName;

            await db.insert(expenses).values({
                projectId,
                date: new Date(date),
                utmCampaign,
                visits: visits || 0,
                cost: "0",
            }).onConflictDoUpdate({
                target: [expenses.projectId, expenses.date, expenses.campaignId],
                set: { visits: visits || 0 }
            });
        }

        await db.update(syncLogs).set({ 
            status: "SUCCESS", 
            recordsProcessed: rows.length,
            finishedAt: new Date() 
        }).where(eq(syncLogs.id, logEntry.id));

        return { success: true, count: rows.length };
    } catch (error: any) {
        console.error(`[Visits Sync Error]`, error);
        await db.update(syncLogs).set({ status: "ERROR", error: error.message, finishedAt: new Date() }).where(eq(syncLogs.id, logEntry.id));
        return { error: error.message };
    }
}
