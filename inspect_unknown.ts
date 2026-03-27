import { db } from "./src/db";
import { expenses } from "./src/db/schema";
import { eq, isNull, and, or } from "drizzle-orm";

async function inspect() {
  console.log("--- Inspecting 'Unknown' expenses ---");
  const data = await db.select({
    id: expenses.id,
    date: expenses.date,
    utmCampaign: expenses.utmCampaign,
    directOrder: expenses.directOrder,
    campaignName: expenses.campaignName,
    cost: expenses.cost,
    visits: expenses.visits
  })
  .from(expenses)
  .where(or(
    isNull(expenses.utmCampaign),
    eq(expenses.utmCampaign, ""),
    eq(expenses.utmCampaign, "unknown")
  ))
  .limit(10);

  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

inspect().catch(console.error);
