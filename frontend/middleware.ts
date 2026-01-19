import { NextResponse, type NextRequest } from "next/server";

/**
 * Simplified middleware for POC - no authentication required.
 * All routes are public.
 */
export async function middleware(request: NextRequest) {
  // Simply pass through all requests
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
