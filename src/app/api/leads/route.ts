import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, goalAchievements, projects, targetStatuses, qualificationStatuses, leadStages, projectLinks } from "@/db/schema";
import { eq, and, desc, gte, lte, sql, or, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectIdStr = searchParams.get("projectId");
  const isAllProjects = projectIdStr === "0" || !projectIdStr;
  
  if (isAllProjects && session.role !== "SUPER_ADMIN") {
      // For regular users, find projects they can view leads for
      const allowedLinks = await db
        .select()
        .from(projectLinks)
        .where(and(eq(projectLinks.userId, session.id), eq(projectLinks.canViewLeads, true)));
      
      const allowedProjectIds = allowedLinks.map((l: any) => l.projectId);
      
      if (allowedProjectIds.length === 0) {
          return NextResponse.json([]);
      }
      
      // Force filter by allowed projects
      searchParams.set("allowedProjectIds", allowedProjectIds.join(","));
  } else if (!isAllProjects && session.role !== "SUPER_ADMIN") {
      const projId = parseInt(projectIdStr!);
      const [access] = await db
        .select()
        .from(projectLinks)
        .where(and(eq(projectLinks.projectId, projId), eq(projectLinks.userId, session.id)));
      
      if (!access || !access.canViewLeads) {
          return NextResponse.json({ error: "Access denied to this project's leads" }, { status: 403 });
      }
  }

  const dateFromRaw = searchParams.get("dateFrom");
  const dateToRaw = searchParams.get("dateTo") || dateFromRaw;
  
  const query = searchParams.get("query");
  const sources = searchParams.get("sources")?.split(",").filter(Boolean);
  const goals = searchParams.get("goals")?.split(",").filter(Boolean);
  const targetStatusIds = searchParams.get("targetStatusIds")?.split(",").filter(Boolean).map(id => parseInt(id));
  const qualStatusIds = searchParams.get("qualStatusIds")?.split(",").filter(Boolean).map(id => parseInt(id));
  const stageIds = searchParams.get("stageIds")?.split(",").filter(Boolean).map(id => parseInt(id));
  const allowedProjectIdsStr = searchParams.get("allowedProjectIds");

    try {
        let baseWhere: any[] = [];
        if (projectIdStr && projectIdStr !== '0') {
            baseWhere.push(eq(leads.projectId, parseInt(projectIdStr)));
        } else if (allowedProjectIdsStr) {
            const ids = allowedProjectIdsStr.split(",").map(id => parseInt(id));
            baseWhere.push(inArray(leads.projectId, ids));
        }
        
        console.log(`[API Leads] Filters: dateFrom=${dateFromRaw}, dateTo=${dateToRaw}, projectId=${projectIdStr}`);

        const parseDate = (raw: string | null, isEnd: boolean) => {
            if (!raw) return null;
            try {
                // Если это формат YYYY-MM-DD
                if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                    const [y, m, d] = raw.split('-').map(Number);
                    if (isEnd) return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
                    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
                }
                // Для любых других форматов (ISO и т.д.)
                const d = new Date(raw);
                if (isNaN(d.getTime())) return null;
                return d;
            } catch (e) {
                return null;
            }
        };

        if (dateFromRaw) {
            const dFrom = parseDate(dateFromRaw, false);
            if (dFrom) {
                console.log(`[API Leads] dFrom: ${dFrom.toISOString()}`);
                baseWhere.push(gte(leads.date, dFrom));
            }
        }
        
        if (dateToRaw) {
            const dTo = parseDate(dateToRaw, true);
            if (dTo) {
                console.log(`[API Leads] dTo: ${dTo.toISOString()}`);
                baseWhere.push(lte(leads.date, dTo));
            }
        }
    
    if (sources && sources.length > 0) {
        baseWhere.push(inArray(leads.utmSource, sources));
    }

    if (stageIds && stageIds.length > 0) {
        baseWhere.push(inArray(leads.stageId, stageIds));
    }

    if (targetStatusIds && targetStatusIds.length > 0) {
        baseWhere.push(inArray(goalAchievements.targetStatusId, targetStatusIds));
    }

    if (qualStatusIds && qualStatusIds.length > 0) {
        baseWhere.push(inArray(goalAchievements.qualificationStatusId, qualStatusIds));
    }

    // Search by client ID or Campaign
    if (query) {
        baseWhere.push(or(
            sql`${leads.metrikaClientId} ILIKE ${'%' + query + '%'}`,
            sql`${leads.utmCampaign} ILIKE ${'%' + query + '%'}`
        ));
    }

    const results = await db.select({
      lead: leads,
      project: projects,
      achievements: sql`COALESCE(
        json_agg(
          json_build_object(
            'id', ${goalAchievements.id},
            'goalName', ${goalAchievements.goalName},
            'goalId', ${goalAchievements.goalId},
            'saleAmount', ${goalAchievements.saleAmount},
            'targetStatusId', ${goalAchievements.targetStatusId},
            'qualificationStatusId', ${goalAchievements.qualificationStatusId}
          )
        ) FILTER (WHERE ${goalAchievements.id} IS NOT NULL),
        '[]'
      )`.as("achievements")
    })
    .from(leads)
    .innerJoin(projects, eq(leads.projectId, projects.id))
    .leftJoin(goalAchievements, eq(leads.id, goalAchievements.leadId))
    .where(and(...baseWhere))
    .groupBy(leads.id, projects.id)
    .having(goals && goals.length > 0 
       ? sql`bool_or(${goalAchievements.goalName} IN ${goals})` 
       : sql`true`
    )
    .orderBy(desc(leads.date))
    .limit(100);

    return NextResponse.json(results);
  } catch (error) {
    console.error("Leads fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, leadId, stageId, targetStatusId, qualificationStatusId, saleAmount } = body;

  try {
    // RBAC Check for PATCH
    if (leadId && session.role !== "SUPER_ADMIN") {
        const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
        if (lead) {
            const [access] = await db.select().from(projectLinks).where(and(eq(projectLinks.userId, session.id), eq(projectLinks.projectId, lead.projectId)));
            if (!access || !access.canViewLeads) {
                return NextResponse.json({ error: "No permission to edit this lead" }, { status: 403 });
            }
        }
    }

    if (leadId && stageId !== undefined) {
      await db.update(leads).set({
        stageId: stageId === null ? null : stageId
      }).where(eq(leads.id, leadId));
    }

    if (id && (targetStatusId !== undefined || qualificationStatusId !== undefined || saleAmount !== undefined)) {
      await db.update(goalAchievements).set({
        targetStatusId: targetStatusId === undefined ? undefined : targetStatusId,
        qualificationStatusId: qualificationStatusId === undefined ? undefined : qualificationStatusId,
        saleAmount: saleAmount === undefined ? undefined : saleAmount.toString(),
        updatedAt: new Date(),
      }).where(eq(goalAchievements.id, id));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Lead update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only Super Admin can clear lead data" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  try {
    await db.delete(leads).where(eq(leads.projectId, parseInt(projectId)));
    return NextResponse.json({ success: true, message: "Leads cleared successfully" });
  } catch (error) {
    console.error("Leads delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
