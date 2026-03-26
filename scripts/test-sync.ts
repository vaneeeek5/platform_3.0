
import { syncMetrikaLeads } from "../src/lib/sync/yandex-metrika";
import { db } from "../src/db";

async function test() {
  const projectId = 1; // Assuming project 1
  console.log("Starting manual test sync for project 1...");
  try {
    // Sync for the last 7 days
    const dateTo = new Date();
    const dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const result = await syncMetrikaLeads(projectId, dateFrom.toISOString(), dateTo.toISOString());
    console.log("Sync Result:", result);
  } catch (error) {
    console.error("Sync Error:", error);
  }
}

test().then(() => process.exit());
