import { db } from "@/db";
import { leads, goalAchievements, trackedGoals, campaignMappings } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function syncMetrikaLeads(projectId: number, dateFromStr?: string, dateToStr?: string) {
  const project = await db.query.projects.findFirst({
    where: (projects, { eq }) => eq(projects.id, projectId),
  });

  if (!project || !project.yandexToken || !project.yandexCounterId) {
    return { error: "Missing Yandex credentials" };
  }

  const projectTrackedGoals = await db.select().from(trackedGoals).where(eq(trackedGoals.projectId, projectId));
  if (projectTrackedGoals.length === 0) return { skipped: true, reason: "No tracked goals" };

  const projectMappings = await db.select().from(campaignMappings).where(eq(campaignMappings.projectId, projectId));

  // Yandex Metrika Logs API supports yesterday and earlier
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  let dateTo = dateToStr ? new Date(dateToStr).toISOString().split('T')[0] : yesterday;
  let dateFrom = dateFromStr ? new Date(dateFromStr).toISOString().split('T')[0] : new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  if (dateTo > yesterday) dateTo = yesterday;
  if (dateFrom > dateTo) dateFrom = dateTo;

  console.log(`[Logs API] Starting sync for ${project.yandexCounterId}: ${dateFrom} - ${dateTo}`);

  try {
    // 1. Create Log Request
    // Note: We MUST include all fields we need in the log request
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
    const requestId = log_request.request_id;
    console.log(`[Logs API] Request created: ${requestId}, status: ${log_request.status}`);

    // 2. Poll for completion
    let status = log_request.status;
    let parts: any[] = [];
    let attempts = 0;
    
    while (status !== 'processed' && attempts < 30) {
        console.log(`[Logs API] Polling ${requestId}... Status: ${status} (attempt ${attempts + 1})`);
        await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds
        const pollRes = await fetch(`https://api-metrika.yandex.net/management/v1/counter/${project.yandexCounterId}/logrequest/${requestId}`, {
            headers: { 'Authorization': `OAuth ${project.yandexToken}` }
        });
        if (!pollRes.ok) throw new Error(`Polling failed: ${await pollRes.text()}`);
        const pollData = await pollRes.json();
        status = pollData.log_request.status;
        parts = pollData.log_request.parts || [];
        attempts++;

        if (status === 'canceled' || status === 'cleaning_failed') {
            throw new Error(`Log request failed with status: ${status}`);
        }
    }

    if (status !== 'processed') {
        throw new Error("Log request timed out (taking too long on Yandex side)");
    }

    // 3. Download and Parse Parts
    let totalLeadsCount = 0;
    let totalGoalsCount = 0;

    for (const part of parts) {
        const partNumber = part.part_number;
        console.log(`[Logs API] Downloading part ${partNumber} for request ${requestId}...`);
        const downloadUrl = `https://api-metrika.yandex.net/management/v1/counter/${project.yandexCounterId}/logrequest/${requestId}/part/${partNumber}/download`;
        
        const downloadRes = await fetch(downloadUrl, {
            headers: { 'Authorization': `OAuth ${project.yandexToken}` }
        });
        if (!downloadRes.ok) throw new Error(`Download failed: ${await downloadRes.text()}`);
        
        const tsvOutput = await downloadRes.text();
        const rows = tsvOutput.split('\n');
        const header = rows[0].split('\t');
        
        // Find column indices
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
            
            // GoalsID in Logs API visits can look like [123,456]
            const achievedStrings = rawGoalIds.replace('[','').replace(']','').split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean);

            const trackedAchieved = achievedStrings.filter(id => 
                projectTrackedGoals.some(tg => tg.goalId.toString() === id.toString())
            );

            if (trackedAchieved.length === 0) continue;

            // Mapping: Apply campaign mapping
            const mapping = projectMappings.find(m => m.utmValue === utmCampaign);
            if (mapping) {
                utmCampaign = mapping.displayName || utmCampaign;
            }

            // 1. Insert/Get Lead
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

            totalLeadsCount++;

            // 2. Insert Goal Achievements
            for (const gId of trackedAchieved) {
                const tg = projectTrackedGoals.find(g => g.goalId.toString() === gId.toString());
                if (!tg) continue;

                await db.insert(goalAchievements).values({
                    leadId: lead.id,
                    goalId: gId.toString(),
                    goalName: tg.goalName,
                    // Inherit from goal settings
                    targetStatusId: tg.targetStatusId,
                    qualificationStatusId: tg.qualificationStatusId
                }).onConflictDoNothing();
                
                totalGoalsCount++;
            }
        }
    }

    // 4. Cleanup
    await fetch(`https://api-metrika.yandex.net/management/v1/counter/${project.yandexCounterId}/logrequest/${requestId}/clean`, {
        method: 'POST',
        headers: { 'Authorization': `OAuth ${project.yandexToken}` }
    }).catch(e => console.warn(`Cleanup failed for ${requestId}:`, e));

    return { success: true, leadsCount: totalLeadsCount, goalsCount: totalGoalsCount };

  } catch (error: any) {
    console.error(`[Logs API Error]`, error);
    return { error: error.message };
  }
}
