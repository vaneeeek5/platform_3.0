import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, goalAchievements, projects, targetStatuses, qualificationStatuses } from "@/db/schema";
import { eq, and, desc, gte, lte, sql, or } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const status = searchParams.get("status");
  const query = searchParams.get("query");
  const sources = searchParams.get("sources")?.split(",");
  const goals = searchParams.get("goals")?.split(",");
  const targetStatusIds = searchParams.get("targetStatusIds")?.split(",").map(id => parseInt(id));
  const qualStatusIds = searchParams.get("qualStatusIds")?.split(",").map(id => parseInt(id));

  try {
    let baseWhere = [];
    if (projectId && projectId !== '0') baseWhere.push(eq(leads.projectId, parseInt(projectId)));
    if (dateFrom) baseWhere.push(gte(leads.date, new Date(dateFrom)));
    if (dateTo) {
        const dTo = new Date(dateTo);
        dTo.setHours(23, 59, 59, 999);
        baseWhere.push(lte(leads.date, dTo));
    }
    
    if (sources && sources.length > 0) {
        baseWhere.push(sql`${leads.utmSource} IN ${sources}`);
    }

    if (targetStatusIds && targetStatusIds.length > 0) {
        baseWhere.push(sql`${goalAchievements.targetStatusId} IN ${targetStatusIds}`);
    }

    if (qualStatusIds && qualStatusIds.length > 0) {
        baseWhere.push(sql`${goalAchievements.qualificationStatusId} IN ${qualStatusIds}`);
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

  const { id, targetStatusId, qualificationStatusId, saleAmount } = await request.json();

  try {
    // Usually we update the goal achievement, since a lead can have multiple
    // If id represents goalAchievement.id:
    await db.update(goalAchievements).set({
      targetStatusId: targetStatusId === undefined ? undefined : targetStatusId,
      qualificationStatusId: qualificationStatusId === undefined ? undefined : qualificationStatusId,
      saleAmount: saleAmount === undefined ? undefined : saleAmount.toString(),
      updatedAt: new Date(),
    }).where(eq(goalAchievements.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Lead update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
