import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/auth";

const publicRoutes = ["/login"];

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);

  const cookie = req.cookies.get("auth_token")?.value;
  const session = cookie ? await decrypt(cookie).catch(() => null) : null;

  if (!isPublicRoute && !session) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isPublicRoute && session) {
    // Redirect logged in users away from login page
    // Based on requirement: SUPER_ADMIN/ADMIN -> / projects list, USER -> /{slug} (but we don't know slug yet without project_links)
    // For now, redirect to / projects list
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  // Handle /{slug} routing as per CONTEXT.md
  // /{slug} -> dashboard
  // /{slug}/leads -> only ADMIN+
  // We'll implement more granular role-based checks in the page components or layouts
  // but let's do a basic check here if needed.

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
