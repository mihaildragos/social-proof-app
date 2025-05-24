import { NextRequest, NextResponse } from "next/server";

/**
 * SSE endpoint for notification streams with query parameter siteId
 * This redirects to the proper parameterized route
 */
export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get("siteId");
  
  if (!siteId) {
    return NextResponse.json({ error: "siteId query parameter is required" }, { status: 400 });
  }

  // Redirect to the proper SSE endpoint
  const redirectUrl = new URL(`/api/notifications/sse/${siteId}`, req.nextUrl.origin);
  return NextResponse.redirect(redirectUrl);
} 