import "dotenv/config";
import { Worker } from "bullmq";
import { redis } from "@/lib/redis";
import { SYNC_QUEUE_NAME, CRON_QUEUE_NAME, cronQueue } from "@/lib/queue";
import { syncMetrikaLeads, syncMetrikaVisits } from "@/lib/sync/yandex-metrika";
import { syncDirectExpenses } from "@/lib/sync/yandex-direct";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, isNotNull, and } from "drizzle-orm";

console.log("Worker process starting...");

const worker = new Worker(SYNC_QUEUE_NAME, async (job) => {
  const { projectId, dateFrom, dateTo } = job.data;
  console.log(`[Worker] Starting sync for project ${projectId} from ${dateFrom || 'default'} to ${dateTo || 'default'}...`);

  try {
    // 1. Sync Leads from Metrika
    const metrikaLeadsResult = await syncMetrikaLeads(projectId, dateFrom, dateTo);
    console.log(`[Worker] Metrika Leads Sync for project ${projectId}:`, metrikaLeadsResult);

    // 2. Sync Visits from Metrika
    const metrikaVisitsResult = await syncMetrikaVisits(projectId, dateFrom, dateTo);
    console.log(`[Worker] Metrika Visits Sync for project ${projectId}:`, metrikaVisitsResult);

    // 3. Sync Expenses from Direct
    const directResult = await syncDirectExpenses(projectId, dateFrom, dateTo);
    console.log(`[Worker] Direct Sync for project ${projectId}:`, directResult);

    // 4. Update Last Sync Time
    await db.update(projects).set({ lastSyncAt: new Date() }).where(eq(projects.id, projectId));

    return { metrikaLeadsResult, metrikaVisitsResult, directResult };
  } catch (error) {
    console.error(`[Worker] Error syncing project ${projectId}:`, error);
    throw error;
  }
}, {
  connection: redis,
  concurrency: 2,
});

worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully.`);
});

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err);
});

// --- CRON WORKER ---
const cronWorker = new Worker(CRON_QUEUE_NAME, async (job) => {
  console.log("[Cron] Starting global daily sync...");
  const activeProjects = await db.select().from(projects).where(and(isNotNull(projects.yandexToken), isNotNull(projects.yandexCounterId)));
  
  for (const project of activeProjects) {
     console.log(`[Cron] Queuing sync for project ${project.id} (${project.name})`);
     await syncMetrikaLeads(project.id);
     await syncMetrikaVisits(project.id);
     await syncDirectExpenses(project.id);
     await db.update(projects).set({ lastSyncAt: new Date() }).where(eq(projects.id, project.id));
  }
  return { processed: activeProjects.length };
}, {
  connection: redis,
});

// Schedule the daily sync at 4 AM
cronQueue.add("daily-sync", {}, {
  repeat: { pattern: "0 4 * * *" },
  removeOnComplete: true,
});

console.log(`[Worker] Listening on: ${SYNC_QUEUE_NAME} and ${CRON_QUEUE_NAME}`);
