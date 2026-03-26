import { Queue } from "bullmq";
import { redis } from "./redis";

export const SYNC_QUEUE_NAME = "manual-sync-queue";
export const CRON_QUEUE_NAME = "cron-sync-queue";

export const syncQueue = new Queue(SYNC_QUEUE_NAME, {
  connection: redis,
});

export const cronQueue = new Queue(CRON_QUEUE_NAME, {
  connection: redis,
});

export async function addSyncJob(projectId: number, dateFrom?: string, dateTo?: string) {
  await syncQueue.add(`sync-project-${projectId}`, { projectId, dateFrom, dateTo }, {
    removeOnComplete: true,
    removeOnFail: false,
  });
}
