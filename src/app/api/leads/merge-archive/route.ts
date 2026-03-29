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
    const statusResults = { updated: 0, skipped: 0, partialMatches: 0 };

    // Пре-фетч дефолтных положительных статусов проекта
    const [targetList, qualList, stageList] = await Promise.all([
        db.query.targetStatuses.findMany({ where: eq(targetStatuses.projectId, projectId) }),
        db.query.qualificationStatuses.findMany({ where: eq(qualificationStatuses.projectId, projectId) }),
        db.query.leadStages.findMany({ where: eq(leadStages.projectId, projectId) })
    ]);

    const defaultTargetId = targetList.find(t => t.isPositive)?.id || targetList[0]?.id;
    const defaultQualId = qualList.find(q => q.isPositive)?.id || qualList[0]?.id;
    const defaultStageId = stageList.find(s => s.label.toLowerCase().includes("закрыто") || s.label.toLowerCase().includes("продажа") || s.label.toLowerCase().includes("реализовано"))?.id || stageList[stageList.length - 1]?.id;

    console.log(`[Smart Sync] Starting merge. Payload rows: ${rows.length}`);
    console.log(`[Smart Sync] First row preview:`, rows[0]);
    console.log(`[Smart Sync] Default IDs -> Target: ${defaultTargetId}, Qual: ${defaultQualId}, Stage: ${defaultStageId}`);

    for (const row of rows) {
      let matchedLead = null;

      // Priority 0: Exact Match by Client ID (_ym_uid)
      if (row.clientId) {
         matchedLead = await db.query.leads.findFirst({
            where: and(eq(leads.projectId, projectId), eq(leads.metrikaClientId, String(row.clientId).trim()))
         });
         if (matchedLead) {
             console.log(`[Smart Sync] Match Priority 0 (Client ID) -> Lead ${matchedLead.id}`);
         }
      }

      // Priority 1-3: Fallback Date Match 
      if (!matchedLead && row.date) {
        let rowDate = new Date(row.date);

        // Если дата в формате DD.MM.YYYY, JS Date может спарсить криво, попробуем исправить:
        if (isNaN(rowDate.getTime()) && typeof row.date === 'string' && row.date.includes('.')) {
             const parts = row.date.split(' ')[0].split('.');
             if (parts.length === 3) {
                 rowDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`);
             }
        }

        if (!isNaN(rowDate.getTime())) {
            // Tier 1: Exact Match (Minute precision)
            const minuteStart = new Date(rowDate);
            minuteStart.setSeconds(0, 0);
            const minuteEnd = new Date(rowDate);
            minuteEnd.setSeconds(59, 999);

            matchedLead = await db.query.leads.findFirst({
              where: and(eq(leads.projectId, projectId), between(leads.date, minuteStart, minuteEnd))
            });

            // Tier 2: Range Match (±10 minutes)
            if (!matchedLead) {
              const rangeStart = subMinutes(rowDate, 10);
              const rangeEnd = addMinutes(rowDate, 10);
              matchedLead = await db.query.leads.findFirst({
                where: and(eq(leads.projectId, projectId), between(leads.date, rangeStart, rangeEnd))
              });
            }

            // Tier 3: Single Match per Day
            if (!matchedLead) {
              const dayLeads = await db.select().from(leads).where(and(
                eq(leads.projectId, projectId),
                gte(leads.date, startOfDay(rowDate)),
                lte(leads.date, endOfDay(rowDate))
              ));

              if (dayLeads.length === 1) {
                matchedLead = dayLeads[0];
                console.log(`[Smart Sync] Match P3 (Day 1 lead) -> Lead ${matchedLead.id}`);
              }
            } else {
               console.log(`[Smart Sync] Match P1/P2 (Date exact/range) -> Lead ${matchedLead.id}`);
            }
        }
      }

      // Update matched lead
      if (matchedLead) {
        let updated = false;
        
        // 1. Установка этапа (из Stage Id, который передал интерфейс маппинга)
        if (row.stageId) {
          await db.update(leads).set({ stageId: row.stageId }).where(eq(leads.id, matchedLead.id));
          updated = true;
        }

        // 2. Установка целей
        if ((row.target && defaultTargetId) || (row.qual && defaultQualId)) {
          const achievements = await db.select().from(goalAchievements).where(eq(goalAchievements.leadId, matchedLead.id));
          for (const ach of achievements) {
             await db.update(goalAchievements).set({
               targetStatusId: row.target && defaultTargetId ? defaultTargetId : ach.targetStatusId,
               qualificationStatusId: row.qual && defaultQualId ? defaultQualId : ach.qualificationStatusId,
               updatedAt: new Date()
             }).where(eq(goalAchievements.id, ach.id));
          }
          updated = true;
        }

        if (updated) {
           statusResults.updated++;
        } else {
           console.log(`[Smart Sync] Skipped (found but no goals/stage to update): Target=${row.target}, Qual=${row.qual}, StageId=${row.stageId}`);
           statusResults.skipped++; // Нашли, но ничего обновлять не нужно
        }
      } else {
        console.log(`[Smart Sync] Skipped (No Match found). clientId=${row.clientId}, date=${row.date}`);
        statusResults.skipped++; // Не нашли лида
      }
    }

    return NextResponse.json(statusResults);
  } catch (error) {
    console.error("Merge archive error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
