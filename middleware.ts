import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Clerk middleware for authentication
 */
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/protected(.*)", 
  "/test-control-panel(.*)"
]);

export default clerkMiddleware(async (auth, req) => {
  // Force HTTPS redirect in non-development environments
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv !== 'development') {
    const proto = req.headers.get('x-forwarded-proto');
    const host = req.headers.get('host');
    
    // If the request is HTTP, redirect to HTTPS
    if (proto === 'http' || (!proto && req.url.startsWith('http://'))) {
      const httpsUrl = `https://${host}${req.nextUrl.pathname}${req.nextUrl.search}`;
      return NextResponse.redirect(httpsUrl, 301);
    }
  }

  if (isProtectedRoute(req)) {
    // Protect the dashboard, test control panel and other protected routes
    await auth.protect();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)|api/webhooks).*)",
  ],
};
