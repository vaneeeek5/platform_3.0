import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, goalAchievements, crmStageMappings } from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { verifyProjectAccess } from "@/lib/permissions";

/**
 * Robust date parser for various formats (common in CRM exports)
 */
function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  // Try DD.MM.YYYY or DD/MM/YYYY
  const parts = dateStr.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (parts) {
    const d = parseInt(parts[1]);
    const m = parseInt(parts[2]);
    const y = parseInt(parts[3]);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (!isNaN(date.getTime())) return date;
  }

  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const projectId = parseInt(id);
  
  // SECURITY: Check project access
  const hasAccess = await verifyProjectAccess(session.id, session.role, projectId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, mapping, headers } = await request.json();

  if (!data || !mapping.clientId || !mapping.status) {
    return NextResponse.json({ error: "Missing data or mapping" }, { status: 400 });
  }

  // 1. Fetch project mappings to resolve statuses/stages
  const projectMappings = await db.select().from(crmStageMappings).where(eq(crmStageMappings.projectId, projectId));

  const ciIdx = headers.indexOf(mapping.clientId);
  const stIdx = headers.indexOf(mapping.status);
  const amIdx = mapping.amount ? headers.indexOf(mapping.amount) : -1;
  const dtIdx = mapping.date ? headers.indexOf(mapping.date) : -1;

  // 2. Prepare unique Client IDs from input
  const inputClientIds = Array.from(new Set(data.map((row: any) => row[ciIdx]?.toString()).filter(Boolean)));
  
  if (inputClientIds.length === 0) {
      return NextResponse.json({ success: true, updated: 0, created: 0 });
  }

  try {
    // 3. Fetch all existing leads for these client IDs in this project
    const existingLeads = await db.select().from(leads).where(
        and(eq(leads.projectId, projectId), inArray(leads.metrikaClientId, inputClientIds as string[]))
    );
    
    // Cache for faster lookup
    const leadMap = new Map(existingLeads.map(l => [l.metrikaClientId, l]));

    let updatedCount = 0;
    let createdCount = 0;

    // 4. Batch Process within a single transaction
    await db.transaction(async (tx) => {
      for (const row of data) {
        const clientId = row[ciIdx]?.toString();
        const statusLabel = row[stIdx]?.toString();
        const amount = amIdx !== -1 ? parseFloat(row[amIdx]?.toString().replace(',', '.') || "0") : 0;
        const date = dtIdx !== -1 ? parseDate(row[dtIdx]?.toString()) : new Date();

        if (!clientId) continue;

        // Find mapping for the CRM status text
        const rule = projectMappings.find(m => m.crmStageName.toLowerCase() === statusLabel?.toLowerCase());
        
        let leadId: number;
        const existingLead = leadMap.get(clientId);

        if (existingLead) {
          leadId = existingLead.id;
          updatedCount++;
        } else {
          // Create new lead if it doesn't exist
          const [newLead] = await tx.insert(leads).values({
            projectId,
            metrikaVisitId: `crm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${clientId}`,
            metrikaClientId: clientId,
            date: date,
            utmSource: 'crm'
          }).returning({ id: leads.id });
          
          leadId = newLead.id;
          createdCount++;
        }

        // Upsert goal achievement (matching by leadId and "manual_crm" goal)
        // Drizzle doesn't have a clean upsert for multiple conditions without constraints,
        // but here we can check first and then act via the tx
        const [existingGa] = await tx.select().from(goalAchievements).where(
            and(eq(goalAchievements.leadId, leadId), eq(goalAchievements.goalId, "manual_crm"))
        ).limit(1);

        if (existingGa) {
            await tx.update(goalAchievements).set({
                targetStatusId: rule?.targetStatusId ?? existingGa.targetStatusId,
                qualificationStatusId: rule?.qualificationStatusId ?? existingGa.qualificationStatusId,
                saleStatusId: rule?.saleStatusId ?? existingGa.saleStatusId,
                saleAmount: amount ? amount.toString() : existingGa.saleAmount,
                updatedAt: new Date()
            }).where(eq(goalAchievements.id, existingGa.id));
        } else {
            await tx.insert(goalAchievements).values({
                leadId: leadId,
                goalId: "manual_crm",
                goalName: "Manual Import",
                targetStatusId: rule?.targetStatusId,
                qualificationStatusId: rule?.qualificationStatusId,
                saleStatusId: rule?.saleStatusId,
                saleAmount: amount.toString(),
            });
        }
        
        // Update lead stage if mapping exists
        if (rule?.leadStageId) {
            await tx.update(leads).set({ stageId: rule.leadStageId }).where(eq(leads.id, leadId));
        }
      }
    });

    return NextResponse.json({ success: true, updated: updatedCount, created: createdCount });
  } catch (error: any) {
    console.error("CRM Import error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
