import { db } from "@/db";
import { leads, goalAchievements, trackedGoals } from "@/db/schema";
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

  // Yandex Metrika Logs-like data is best for yesterday and earlier
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  let dateTo = dateToStr ? new Date(dateToStr).toISOString().split('T')[0] : yesterday;
  let dateFrom = dateFromStr ? new Date(dateFromStr).toISOString().split('T')[0] : new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Cap to yesterday
  if (dateTo > yesterday) dateTo = yesterday;
  if (dateFrom > dateTo) dateFrom = dateTo;

  // We use the "Log-like" report to get individual visit data with goals
  // ids: counter id
  // metrics: any dummy metric, we care about dimensions
  // dimensions: visitId, clientID, dateTime, utmCampaign, utmSource, goalsID
  
  // Note: ym:s:goalsID returns an array of goal IDs achieved in the visit
  const url = `https://api-metrika.yandex.net/stat/v1/data?ids=${project.yandexCounterId}&metrics=ym:s:visits&dimensions=ym:s:visitID,ym:s:clientID,ym:s:dateTime,ym:s:lastUTMCampaign,ym:s:lastUTMSource,ym:s:goalsID&date1=${dateFrom}&date2=${dateTo}&accuracy=full&limit=1000`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `OAuth ${project.yandexToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Metrika API Error: ${await response.text()}`);
  }

  const data = await response.json();
  const rows = data.data || [];
  console.log(`[Metrika Sync] Counter ${project.yandexCounterId}: Found ${rows.length} visit rows for period ${dateFrom} - ${dateTo}`);

  let leadsCount = 0;
  let goalsCount = 0;

  for (const row of rows) {
    const visitId = row.dimensions[0].id;
    const clientId = row.dimensions[1].name;
    const dateTime = row.dimensions[2].name;
    const utmCampaign = row.dimensions[3]?.name || "";
    const utmSource = row.dimensions[4]?.name || "";
    const rawGoalIds = row.dimensions[5]?.id;

    // Normalize goal IDs to an array of strings
    const achievedGoalIds: string[] = Array.isArray(rawGoalIds) 
      ? rawGoalIds.map((id: any) => id.toString()) 
      : (rawGoalIds ? [rawGoalIds.toString()] : []);

    // Filter goals to only those we are tracking
    const trackedAchieved = achievedGoalIds.filter((id: string) => 
      projectTrackedGoals.some(tg => tg.goalId.toString() === id.toString())
    );

    if (trackedAchieved.length === 0) continue;
    
    console.log(`[Metrika Sync] Visit ${visitId} from ${utmSource} reached tracked goals: ${trackedAchieved.join(', ')}`);

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
      set: { utmCampaign, utmSource } // Update UTMs if they changed or were missing
    }).returning();

    leadsCount++;

    // 2. Insert Goal Achievements
    for (const gId of trackedAchieved) {
      const tg = projectTrackedGoals.find(g => g.goalId.toString() === gId.toString());
      if (!tg) continue;

      await db.insert(goalAchievements).values({
        leadId: lead.id,
        goalId: gId.toString(),
        goalName: tg.goalName,
        // We could also set targetStatusId/qualificationStatusId here if we wanted default mapping
      }).onConflictDoNothing(); // Requires unique constraint on (leadId, goalId) - if not exists, we use manual check
      
      goalsCount++;
    }
  }

  return { success: true, leadsCount, goalsCount };
}
