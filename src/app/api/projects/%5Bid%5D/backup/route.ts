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
import fs from "fs";
import path from "path";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = parseInt(params.id);

  try {
    const data = await getProjectBackupData(projectId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Backup error:", error);
    return NextResponse.json({ error: "Failed to generate backup" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = parseInt(params.id);

  try {
    const data = await getProjectBackupData(projectId);
    const backupDir = path.join(process.cwd(), "storage", "backups");
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const filePath = path.join(backupDir, `project_${projectId}_last.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    return NextResponse.json({ 
        success: true, 
        path: filePath,
        timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Server backup error:", error);
    return NextResponse.json({ error: "Failed to save backup to server" }, { status: 500 });
  }
}

async function getProjectBackupData(projectId: number) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  const tStatuses = await db.select().from(targetStatuses).where(eq(targetStatuses.projectId, projectId));
  const qStatuses = await db.select().from(qualificationStatuses).where(eq(qualificationStatuses.projectId, projectId));
  const lStages = await db.select().from(leadStages).where(eq(leadStages.projectId, projectId));
  const goals = await db.select().from(trackedGoals).where(eq(trackedGoals.projectId, projectId));
  const cMappings = await db.select().from(campaignMappings).where(eq(campaignMappings.projectId, projectId));
  const csMappings = await db.select().from(crmStageMappings).where(eq(crmStageMappings.projectId, projectId));
  const ccMappings = await db.select().from(crmColumnMappings).where(eq(crmColumnMappings.projectId, projectId));
  const projectLeads = await db.select().from(leads).where(eq(leads.projectId, projectId));
  const projectExpenses = await db.select().from(expenses).where(eq(expenses.projectId, projectId));
  
  const leadIds = projectLeads.map(l => l.id);
  const achievements = leadIds.length > 0 
    ? await db.select().from(goalAchievements).where(inArray(goalAchievements.leadId, leadIds))
    : [];

  return {
    version: "1.0",
    timestamp: new Date().toISOString(),
    project: {
        name: project.name,
        slug: project.slug,
        yandexToken: project.yandexToken,
        yandexCounterId: project.yandexCounterId,
        yandexDirectLogins: project.yandexDirectLogins,
        syncSchedule: project.syncSchedule,
        syncEnabled: project.syncEnabled,
        syncPeriodDays: project.syncPeriodDays,
        yandexUtmsAllowed: project.yandexUtmsAllowed,
    },
    config: {
        targetStatuses: tStatuses,
        qualificationStatuses: qStatuses,
        leadStages: lStages,
        trackedGoals: goals,
        campaignMappings: cMappings,
        crmStageMappings: csMappings,
        crmColumnMappings: ccMappings,
    },
    data: {
        leads: projectLeads,
        expenses: projectExpenses,
        goalAchievements: achievements
    }
  };
}
