import { NextRequest, NextResponse } from "next/server";
import { createTestSiteWithIntegration } from "@/lib/test-helpers";

/**
 * DEBUG ENDPOINT - Bypass auth for testing site creation
 * This endpoint is only for debugging the site creation issue
 */
export async function POST(request: NextRequest) {
  try {
    console.log("🔍 DEBUG: Test site creation endpoint called");
    
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: "Debug endpoint only available in development" }, { status: 403 });
    }

    const body = await request.json();
    const { userId = "debug-user", userName = "Debug User" } = body;

    console.log(`🔍 DEBUG: Creating test site for user: ${userId}`);

    // Create test site using the same function as the control panel
    const result = await createTestSiteWithIntegration(userId, userName);

    console.log("🔍 DEBUG: Test site creation result:", result);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        debug: true
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      site: result.site,
      debug: true,
      message: "Test site created successfully via debug endpoint"
    });

  } catch (error: any) {
    console.error("🔍 DEBUG: Error in test site creation:", error);
    return NextResponse.json({
      success: false,
      error: error.message,
      debug: true
    }, { status: 500 });
  }
} 