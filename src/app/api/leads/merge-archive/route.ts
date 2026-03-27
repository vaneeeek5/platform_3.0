import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, goalAchievements, crmStageMappings, leadStages, targetStatuses, qualificationStatuses } from "@/db/schema";
import { eq, and, sql, gte, lte, between } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { startOfDay, endOfDay, addMinutes, subMinutes } from "date-fns";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, rows } = await request.json();
  if (!projectId || !rows) return NextResponse.json({ error: "Missing data" }, { status: 400 });

  try {
    // 1. Fetch Mappings
    const mappings = await db
      .select()
      .from(crmStageMappings)
      .where(eq(crmStageMappings.projectId, projectId));

    const statusResults = { updated: 0, skipped: 0, partialMatches: 0 };

    for (const row of rows) {
      const rowDate = new Date(row.date);
      const rowCampaign = row.campaign || null;
      const crmStatus = row.status;

      const mapping = mappings.find(m => m.crmStageName.toLowerCase() === crmStatus?.toLowerCase());
      if (!mapping) {
        statusResults.skipped++;
        continue;
      }

      // Tier 1: Exact Match (Minute precision)
      const minuteStart = new Date(rowDate);
      minuteStart.setSeconds(0, 0);
      const minuteEnd = new Date(rowDate);
      minuteEnd.setSeconds(59, 999);

      let matchedLead = await db.query.leads.findFirst({
        where: and(
          eq(leads.projectId, projectId),
          between(leads.date, minuteStart, minuteEnd),
          rowCampaign ? eq(leads.utmCampaign, rowCampaign) : sql`${leads.utmCampaign} IS NULL`
        )
      });

      // Tier 2: Range Match (±10 minutes)
      if (!matchedLead) {
        const rangeStart = subMinutes(rowDate, 10);
        const rangeEnd = addMinutes(rowDate, 10);
        matchedLead = await db.query.leads.findFirst({
          where: and(
            eq(leads.projectId, projectId),
            between(leads.date, rangeStart, rangeEnd),
            rowCampaign ? eq(leads.utmCampaign, rowCampaign) : sql`${leads.utmCampaign} IS NULL`
          )
        });
      }

      // Tier 3: Single Match per Day
      if (!matchedLead) {
        const dayLeads = await db.select().from(leads).where(and(
          eq(leads.projectId, projectId),
          gte(leads.date, startOfDay(rowDate)),
          lte(leads.date, endOfDay(rowDate)),
          rowCampaign ? eq(leads.utmCampaign, rowCampaign) : sql`${leads.utmCampaign} IS NULL`
        ));

        if (dayLeads.length === 1) {
          matchedLead = dayLeads[0];
        }
      }

      if (matchedLead) {
        // Update statuses
        // 1. Update lead stage
        if (mapping.leadStageId) {
          await db.update(leads).set({ stageId: mapping.leadStageId }).where(eq(leads.id, matchedLead.id));
        }

        // 2. Update goal achievement (pick first one for simplicity, or all if needed)
        const achievements = await db.select().from(goalAchievements).where(eq(goalAchievements.leadId, matchedLead.id));
        for (const ach of achievements) {
           await db.update(goalAchievements).set({
             targetStatusId: mapping.targetStatusId || undefined,
             qualificationStatusId: mapping.qualificationStatusId || undefined,
             updatedAt: new Date()
           }).where(eq(goalAchievements.id, ach.id));
        }

        statusResults.updated++;
      } else {
        statusResults.skipped++;
      }
    }

    return NextResponse.json(statusResults);
  } catch (error) {
    console.error("Merge archive error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
