import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, projectLinks, projects } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt
    }).from(users);

    const allLinks = await db.select().from(projectLinks);
    
    // Combine data: each user with their links
    const usersWithLinks = allUsers.map(u => ({
      ...u,
      links: allLinks.filter(l => l.userId === u.id)
    }));

    return NextResponse.json(usersWithLinks);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { email, password, role } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [newUser] = await db.insert(users).values({
      email,
      passwordHash,
      role: role || "USER",
    }).returning({
      id: users.id,
      email: users.email,
      role: users.role
    });

    return NextResponse.json(newUser);
  } catch (error: any) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }
    console.error("Failed to create user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  
    try {
      const { userId, projectId, permissions, role, removeLink } = await request.json();
  
      if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });
  
      // 1. Update Global Role if provided
      if (role && !projectId) {
          await db.update(users).set({ role }).where(eq(users.id, userId));
      }
  
      // 2. Manage Project Link
      if (projectId) {
          if (removeLink) {
              await db.delete(projectLinks).where(and(eq(projectLinks.userId, userId), eq(projectLinks.projectId, projectId)));
          } else {
              // Upsert link
              const [existing] = await db.select().from(projectLinks).where(and(eq(projectLinks.userId, userId), eq(projectLinks.projectId, projectId)));
              
              const values = {
                  userId,
                  projectId,
                  role: permissions?.role || "VIEWER",
                  canViewDashboard: permissions?.canViewDashboard !== undefined ? permissions.canViewDashboard : true,
                  canViewLeads: permissions?.canViewLeads !== undefined ? permissions.canViewLeads : true,
                  canViewExpenses: permissions?.canViewExpenses !== undefined ? permissions.canViewExpenses : true,
                  canViewSettings: permissions?.canViewSettings !== undefined ? permissions.canViewSettings : false,
                  canViewLogs: permissions?.canViewLogs !== undefined ? permissions.canViewLogs : false,
              };
  
              if (existing) {
                  await db.update(projectLinks).set(values).where(eq(projectLinks.id, existing.id));
              } else {
                  await db.insert(projectLinks).values(values);
              }
          }
      }
  
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Failed to update permissions:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
