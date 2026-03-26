import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, goalAchievements, targetStatuses, qualificationStatuses } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const projectId = parseInt(id);
  const { data, mapping, headers } = await request.json();

  if (!data || !mapping.clientId || !mapping.status) {
    return NextResponse.json({ error: "Missing data or mapping" }, { status: 400 });
  }

  // Get project statuses for mapping strings
  const [targetS, qualS] = await Promise.all([
    db.select().from(targetStatuses).where(eq(targetStatuses.projectId, projectId)),
    db.select().from(qualificationStatuses).where(eq(qualificationStatuses.projectId, projectId))
  ]);

  const ciIdx = headers.indexOf(mapping.clientId);
  const stIdx = headers.indexOf(mapping.status);
  const amIdx = mapping.amount ? headers.indexOf(mapping.amount) : -1;
  const dtIdx = mapping.date ? headers.indexOf(mapping.date) : -1;

  let updatedCount = 0;
  let createdCount = 0;

  try {
    for (const row of data) {
      const clientId = row[ciIdx]?.toString();
      const statusLabel = row[stIdx]?.toString();
      const amount = amIdx !== -1 ? parseFloat(row[amIdx]?.toString().replace(',', '.') || "0") : 0;
      const date = dtIdx !== -1 ? new Date(row[dtIdx]) : new Date();

      if (!clientId) continue;

      // 1. Try to find existing lead by metrikaClientId
      const existingLead = await db.query.leads.findFirst({
        where: (leads, { and, eq }) => and(
          eq(leads.projectId, projectId),
          eq(leads.metrikaClientId, clientId)
        )
      });

      // Map status label to status ID if possible
      const tStatus = targetS.find(s => s.label.toLowerCase() === statusLabel?.toLowerCase());
      const qStatus = qualS.find(s => s.label.toLowerCase() === statusLabel?.toLowerCase());

      if (existingLead) {
        // Update first goal achievement or lead directly
        // Usually, we'd update goal_achievements
        const ga = await db.query.goalAchievements.findFirst({
           where: (ga, { eq }) => eq(ga.leadId, existingLead.id)
        });

        if (ga) {
           await db.update(goalAchievements).set({
              targetStatusId: tStatus?.id || ga.targetStatusId,
              qualificationStatusId: qStatus?.id || ga.qualificationStatusId,
              saleAmount: amount ? amount.toString() : ga.saleAmount,
           }).where(eq(goalAchievements.id, ga.id));
        } else {
           // Insert new achievement if none exists
           await db.insert(goalAchievements).values({
               leadId: existingLead.id,
               goalId: "manual_crm",
               goalName: "Manual Import",
               targetStatusId: tStatus?.id,
               qualificationStatusId: qStatus?.id,
               saleAmount: amount.toString(),
           });
        }
        updatedCount++;
      } else {
        // Create new standalone lead for CRM data
        const [newLead] = await db.insert(leads).values({
          projectId,
          metrikaVisitId: `crm_${Date.now()}_${clientId}`,
          metrikaClientId: clientId,
          date: isNaN(date.getTime()) ? new Date() : date,
          utmSource: 'crm'
        }).returning();

        await db.insert(goalAchievements).values({
          leadId: newLead.id,
          goalId: "manual_crm",
          goalName: "Manual Import",
          targetStatusId: tStatus?.id,
          qualificationStatusId: qStatus?.id,
          saleAmount: amount.toString(),
        });
        createdCount++;
      }
    }

    return NextResponse.json({ success: true, updated: updatedCount, created: createdCount });
  } catch (error) {
    console.error("CRM Import error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
