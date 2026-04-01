import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession, encrypt } from "@/lib/auth";
import { cookies } from "next/headers";

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const newPrefs = await request.json();
    
    // 1. Fetch current user to get existing preferences
    const [user] = await db.select().from(users).where(eq(users.id, session.id)).limit(1);
    const updatedPrefs = { ...user.preferences, ...newPrefs };

    // 2. Update database
    await db.update(users).set({ preferences: updatedPrefs }).where(eq(users.id, session.id));

    // 3. Update cookie session with new preferences
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const updatedSession = await encrypt({
        ...session,
        preferences: updatedPrefs
    });
    
    const cookieStore = await cookies();
    cookieStore.set("auth_token", updatedSession, { expires, httpOnly: true, secure: false, sameSite: "lax", path: "/" });

    return NextResponse.json({ success: true, preferences: updatedPrefs });
  } catch (error) {
    console.error("Preferences update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
