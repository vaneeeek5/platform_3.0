import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects, projectLinks } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, inArray } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (session.role === "SUPER_ADMIN") {
      const allProjects = await db.select().from(projects);
      return NextResponse.json(allProjects);
    }

    // For regular users, find linked projects
    const links = await db.select().from(projectLinks).where(eq(projectLinks.userId, session.id));
    const projectIds = links.map(l => l.projectId);

    if (projectIds.length === 0) {
      return NextResponse.json([]);
    }

    const linkedProjects = await db.select().from(projects).where(inArray(projects.id, projectIds));
    return NextResponse.json(linkedProjects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, slug } = await request.json();

    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
    }

    const [newProject] = await db.insert(projects).values({
      name,
      slug,
    }).returning();

    return NextResponse.json(newProject);
  } catch (error: any) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
    }
    console.error("Failed to create project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
