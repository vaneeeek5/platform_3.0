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
    } catch (e) {
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
    if (session.role === "SUPER_ADMIN" || session.role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin/projects", req.nextUrl));
    }
  }

  // Handle /admin root redirect
  if (path === "/admin") {
    return NextResponse.redirect(new URL("/admin/projects", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
