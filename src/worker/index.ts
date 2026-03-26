import { Worker } from "bullmq";
import { redis } from "@/lib/redis";
import { SYNC_QUEUE_NAME } from "@/lib/queue";
import { syncMetrikaLeads } from "@/lib/sync/yandex-metrika";
import { syncDirectExpenses } from "@/lib/sync/yandex-direct";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";

console.log("Worker process starting...");

const worker = new Worker(SYNC_QUEUE_NAME, async (job) => {
  const { projectId } = job.data;
  console.log(`[Worker] Starting sync for project ${projectId}...`);

  try {
    // 1. Sync Leads from Metrika
    const metrikaResult = await syncMetrikaLeads(projectId);
    console.log(`[Worker] Metrika Sync for project ${projectId}:`, metrikaResult);

    // 2. Sync Expenses from Direct
    const directResult = await syncDirectExpenses(projectId);
    console.log(`[Worker] Direct Sync for project ${projectId}:`, directResult);

    // 3. Update Last Sync Time
    await db.update(projects).set({ lastSyncAt: new Date() }).where(eq(projects.id, projectId));

    return { metrikaResult, directResult };
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

console.log(`[Worker] Listening on queue: ${SYNC_QUEUE_NAME}`);
