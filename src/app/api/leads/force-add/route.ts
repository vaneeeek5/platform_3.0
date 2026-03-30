import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, goalAchievements, trackedGoals, leadStages, targetStatuses, qualificationStatuses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { parseFlexibleDate } from "@/lib/date-utils";
import { format } from "date-fns";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, rows } = await request.json();
  if (!projectId || !rows) return NextResponse.json({ error: "Missing data" }, { status: 400 });

  try {
    // 1. Ensure CRM_IMPORT goal exists
    let crmGoal = await db.query.trackedGoals.findFirst({
        where: and(eq(trackedGoals.projectId, projectId), eq(trackedGoals.goalId, "CRM_IMPORT"))
    });

    if (!crmGoal) {
        const [newGoal] = await db.insert(trackedGoals).values({
            projectId,
            goalId: "CRM_IMPORT",
            goalName: "Импорт из CRM",
            displayName: "Импорт из CRM",
            isActive: true
        }).returning();
        crmGoal = newGoal;
    }

    let addedCount = 0;

    for (const row of rows) {
      if (!row.clientId && !row.date) continue;

      const rowDate = parseFlexibleDate(row.date);
      const dateStr = format(rowDate, 'yyyy-MM-dd-HH-mm-ss');
      
      // Добавляем источник по умолчанию для лучшей фильтрации
      const utmSource = row.utmSource || 'CRM Import';

      // Deterministic but unique visit ID for manual leads
      const uniqueVisitId = `crm_${row.clientId || 'anon'}_${dateStr}_${Math.random().toString(36).substring(7)}`;

      // 2. Create/Update Lead
      const [lead] = await db.insert(leads).values({
          projectId,
          metrikaVisitId: uniqueVisitId,
          metrikaClientId: row.clientId ? String(row.clientId) : null,
          date: rowDate,
          utmSource: utmSource,
          utmCampaign: row.utmCampaign || null,
      }).onConflictDoUpdate({
          target: [leads.projectId, leads.metrikaVisitId],
          set: {
              utmSource: utmSource,
              utmCampaign: row.utmCampaign || null,
          }
      }).returning();

      // 3. Create Goal Achievement
      const [achievement] = await db.insert(goalAchievements).values({
          leadId: lead.id,
          goalId: "CRM_IMPORT",
          goalName: "Импорт из CRM",
          updatedAt: new Date()
      }).onConflictDoUpdate({
          target: [goalAchievements.id], // Not ideal but onConflict is required by Drizzle for some drivers
          set: { updatedAt: new Date() }
      }).returning();

      // 4. Resolve and Update Statuses (Target, Qual, Stage)
      const resolveStatus = async (table: any, rawValue: string, mappedValue: string | number, isStage = false) => {
          if (!rawValue || mappedValue === 'ignore') return null;
          if (typeof mappedValue === 'number') return mappedValue;
          if (mappedValue === 'auto') {
              const existing = await db.select().from(table).where(eq(table.projectId, projectId));
              const found = existing.find((e: any) => e.label?.toLowerCase() === rawValue.toLowerCase());
              if (found) return found.id;

              const result: any = await db.insert(table).values({
                  projectId,
                  label: rawValue.trim(),
                  color: '#' + Math.floor(Math.random()*16777215).toString(16),
                  isPositive: isStage ? undefined : true,
              }).returning();
              return result[0].id;
          }
          return null;
      };

      const finalStageId = await resolveStatus(leadStages, row.stageRaw, row.stageMap, true);
      const finalTargetId = await resolveStatus(targetStatuses, row.targetRaw, row.targetMap, false);
      const finalQualId = await resolveStatus(qualificationStatuses, row.qualRaw, row.qualMap, false);

      const updatesLead: any = {};
      if (finalStageId) updatesLead.stageId = finalStageId;
      if (Object.keys(updatesLead).length > 0) {
          await db.update(leads).set(updatesLead).where(eq(leads.id, lead.id));
      }

      const updatesAch: any = {};
      if (finalTargetId) updatesAch.targetStatusId = finalTargetId;
      if (finalQualId) updatesAch.qualificationStatusId = finalQualId;
      if (Object.keys(updatesAch).length > 0) {
          await db.update(goalAchievements).set(updatesAch).where(eq(goalAchievements.id, achievement.id));
      }

      addedCount++;
    }

    return NextResponse.json({ success: true, count: addedCount });
  } catch (error) {
    console.error("Force add leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
