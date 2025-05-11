import { clerkMiddleware } from "@clerk/nextjs/server";

// These routes are public and don't require authentication
const publicRoutes = [
  "/",
  "/api/webhooks/(.*)",
  "/api/embed/(.*)"
];

// Export the clerkMiddleware with proper configuration
export default clerkMiddleware();

// Configuration for the middleware matcher 
export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)",
    "/",
    "/(api|trpc)(.*)"
  ],
};
