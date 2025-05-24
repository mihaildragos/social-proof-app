import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateTestSite, validateTestSite, deleteTestSite, cleanupOldTestSites } from "@/lib/test-helpers";

/**
 * GET /api/test-control-panel/test-site
 * Get or create a test site for the authenticated user
 */
export async function GET() {
  try {
    console.log("=== Test Site API Called ===");
    const { userId } = await auth();
    console.log("User ID from auth:", userId);
    
    if (!userId) {
      console.log("No user ID found, returning unauthorized");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("Calling getOrCreateTestSite for user:", userId);
    // Get or create test site for the user
    const result = await getOrCreateTestSite(userId);
    console.log("getOrCreateTestSite result:", result);
    
    if (!result.success) {
      console.log("getOrCreateTestSite failed:", result.error);
      return NextResponse.json(
        { 
          success: false, 
          error: result.error 
        },
        { status: 500 }
      );
    }

    // Validate the test site configuration
    if (result.site) {
      const validation = await validateTestSite(result.site.id, userId);
      
      return NextResponse.json({
        success: true,
        site: result.site,
        validation: {
          valid: validation.valid,
          issues: validation.issues,
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: "Failed to create or retrieve test site"
    }, { status: 500 });

  } catch (error: any) {
    console.error("Error in test site API:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Internal server error" 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/test-control-panel/test-site
 * Create a new test site (forcing creation of a new one)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userName, cleanupOld = true } = body;

    // Cleanup old test sites if requested
    if (cleanupOld) {
      await cleanupOldTestSites(userId, 0); // Delete all existing test sites
    }

    // Create new test site
    const result = await getOrCreateTestSite(userId, userName);
    
    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      site: result.site,
      message: "Test site created successfully"
    });

  } catch (error: any) {
    console.error("Error creating test site:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Internal server error" 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/test-control-panel/test-site
 * Delete the user's test site
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');

    if (!siteId) {
      return NextResponse.json(
        { error: "Site ID is required" },
        { status: 400 }
      );
    }

    const deleted = await deleteTestSite(siteId, userId);
    
    if (!deleted) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Failed to delete test site" 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Test site deleted successfully"
    });

  } catch (error: any) {
    console.error("Error deleting test site:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Internal server error" 
      },
      { status: 500 }
    );
  }
} 