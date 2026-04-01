import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/auth";

const publicRoutes = ["/login"];

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);

  const cookie = req.cookies.get("auth_token")?.value;
  let session = null;
  
  if (cookie) {
    try {
      session = await decrypt(cookie);
    } catch (e: any) {
      // Invalid token, redirect to login
      if (!isPublicRoute) {
        return NextResponse.redirect(new URL("/login", req.nextUrl));
      }
    }
  }

  // Redirect unauthenticated users
  if (!isPublicRoute && !session) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // Redirect authenticated users away from public routes
  if (isPublicRoute && session) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  // Role-based redirects for the root "/" path
  if (path === "/" && session) {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }

  // RESTRICT: Users can't access settings or logs directly
  if (session && (path.startsWith("/admin/settings") || path.startsWith("/admin/logs"))) {
    if (session.role !== "SUPER_ADMIN") {
        return NextResponse.redirect(new URL("/admin", req.nextUrl));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
