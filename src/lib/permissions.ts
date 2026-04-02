import { db } from "@/db";
import { projectLinks } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export type ProjectPermission = 'canViewLeads' | 'canViewExpenses' | 'canViewDashboard' | 'canViewLogs' | 'canManageBackups';

/**
 * Checks if a user has access to a specific project with optional specific permission.
 * SUPER_ADMIN has access to everything.
 * ADMIN has relative access based on their project links.
 */
export async function verifyProjectAccess(
  userId: number, 
  userRole: string, 
  projectId: number, 
  permission?: ProjectPermission
): Promise<boolean> {
  // Super admins have universal access
  if (userRole === "SUPER_ADMIN") return true;

  // For others, check the projectLinks table
  const [access] = await db
    .select()
    .from(projectLinks)
    .where(and(
      eq(projectLinks.userId, userId),
      eq(projectLinks.projectId, projectId)
    ));

  if (!access) return false;

  // If a specific permission is requested, check it
  if (permission) {
    return !!(access as any)[permission];
  }

  // If no specific permission is requested, just being linked is enough
  return true;
}
