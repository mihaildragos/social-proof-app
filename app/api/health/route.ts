import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("🏥 Health check endpoint called");

    // Simple health check without external dependencies
    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      service: "social-proof-app"
    });
  } catch (error: any) {
    console.error("Health check error:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
