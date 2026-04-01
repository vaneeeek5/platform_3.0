import { NextResponse } from "next/server";
import { db } from "@/db";
import { 
  projects, 
  targetStatuses, 
  qualificationStatuses, 
  leadStages, 
  trackedGoals, 
  campaignMappings, 
  crmStageMappings, 
  crmColumnMappings, 
  leads, 
  expenses, 
  goalAchievements 
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = parseInt(id);

  try {
    const backup = await request.json();
    
    // Validate backup format
    if (!backup.version || !backup.project || !backup.config || !backup.data) {
        return NextResponse.json({ error: "Invalid backup format" }, { status: 400 });
    }

    await db.transaction(async (tx) => {
        // 1. DELETE ORDER (Reverse dependencies)
        // Clear old results first
        const oldLeads = await tx.select({ id: leads.id }).from(leads).where(eq(leads.projectId, projectId));
        const oldLeadIds = oldLeads.map(l => l.id);
        
        if (oldLeadIds.length > 0) {
            await tx.delete(goalAchievements).where(inArray(goalAchievements.leadId, oldLeadIds));
        }
        
        await tx.delete(leads).where(eq(leads.projectId, projectId));
        await tx.delete(expenses).where(eq(expenses.projectId, projectId));
        
        // Clear configs
        await tx.delete(trackedGoals).where(eq(trackedGoals.projectId, projectId));
        await tx.delete(campaignMappings).where(eq(campaignMappings.projectId, projectId));
        await tx.delete(crmStageMappings).where(eq(crmStageMappings.projectId, projectId));
        await tx.delete(crmColumnMappings).where(eq(crmColumnMappings.projectId, projectId));

        // Clear foundational statuses
        await tx.delete(targetStatuses).where(eq(targetStatuses.projectId, projectId));
        await tx.delete(qualificationStatuses).where(eq(qualificationStatuses.projectId, projectId));
        await tx.delete(leadStages).where(eq(leadStages.projectId, projectId));

        // 2. INSERT FOUNDATION (Keep original IDs if possible or map them)
        // Note: For simplicity and to avoid PK conflicts, we will recreate them and map IDs if needed.
        // But since we delete everything for this project, we can try to insert them as they were.
        // However, serial PKs might cause issues if we force IDs. 
        // Let's map old IDs to new IDs.

        const statusMap: Record<number, number> = {};
        const qStatusMap: Record<number, number> = {};
        const stageMap: Record<number, number> = {};

        for (const s of backup.config.targetStatuses) {
            const { id: oldId, ...data } = s;
            const [newS] = await tx.insert(targetStatuses).values({ ...data, projectId }).returning({ id: targetStatuses.id });
            statusMap[oldId] = newS.id;
        }

        for (const s of backup.config.qualificationStatuses) {
            const { id: oldId, ...data } = s;
            const [newS] = await tx.insert(qualificationStatuses).values({ ...data, projectId }).returning({ id: qualificationStatuses.id });
            qStatusMap[oldId] = newS.id;
        }

        for (const s of backup.config.leadStages) {
            const { id: oldId, ...data } = s;
            const [newS] = await tx.insert(leadStages).values({ ...data, projectId }).returning({ id: leadStages.id });
            stageMap[oldId] = newS.id;
        }

        // 3. INSERT CONFIG
        for (const g of backup.config.trackedGoals) {
            const { id: _, targetStatusId, qualificationStatusId, ...data } = g;
            await tx.insert(trackedGoals).values({ 
                ...data, 
                projectId,
                targetStatusId: targetStatusId ? statusMap[targetStatusId] : null,
                qualificationStatusId: qualificationStatusId ? qStatusMap[qualificationStatusId] : null
            });
        }

        for (const m of backup.config.campaignMappings) {
            const { id: _, ...data } = m;
            await tx.insert(campaignMappings).values({ ...data, projectId });
        }

        for (const m of backup.config.crmStageMappings) {
            const { id: _, targetStatusId, qualificationStatusId, leadStageId, ...data } = m;
            await tx.insert(crmStageMappings).values({ 
                ...data, 
                projectId,
                targetStatusId: targetStatusId ? statusMap[targetStatusId] : null,
                qualificationStatusId: qualificationStatusId ? qStatusMap[qualificationStatusId] : null,
                leadStageId: leadStageId ? stageMap[leadStageId] : null
            });
        }

        for (const m of backup.config.crmColumnMappings) {
            const { id: _, ...data } = m;
            await tx.insert(crmColumnMappings).values({ ...data, projectId });
        }

        // 4. INSERT TRANSACTIONAL
        const leadMap: Record<number, number> = {};
        for (const l of backup.data.leads) {
            const { id: oldId, stageId, ...data } = l;
            const [newL] = await tx.insert(leads).values({ 
                ...data, 
                projectId,
                stageId: stageId ? stageMap[stageId] : null,
                date: new Date(data.date), // Ensure date objects
                createdAt: data.createdAt ? new Date(data.createdAt) : new Date()
            }).returning({ id: leads.id });
            leadMap[oldId] = newL.id;
        }

        for (const e of backup.data.expenses) {
            const { id: _, ...data } = e;
            await tx.insert(expenses).values({ 
                ...data, 
                projectId,
                date: new Date(data.date),
                createdAt: data.createdAt ? new Date(data.createdAt) : new Date()
            });
        }

        // 5. INSERT RESULTS
        for (const a of backup.data.goalAchievements) {
            const { id: _, leadId, targetStatusId, qualificationStatusId, ...data } = a;
            if (!leadMap[leadId]) continue; // Safety
            await tx.insert(goalAchievements).values({ 
                ...data, 
                leadId: leadMap[leadId],
                targetStatusId: targetStatusId ? statusMap[targetStatusId] : null,
                qualificationStatusId: qualificationStatusId ? qStatusMap[qualificationStatusId] : null,
                updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date()
            });
        }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Restore error:", error);
    return NextResponse.json({ error: "Failed to restore backup" }, { status: 500 });
  }
}
