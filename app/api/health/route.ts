import { NextResponse } from "next/server";
import { createClerkSupabaseClientSsr } from "@/utils/supabase/server";

export async function GET() {
  try {
    console.log("🏥 Health check endpoint called");

    // Test database connection
    const supabase = await createClerkSupabaseClientSsr();

    // Simple query to test connection
    const { data, error } = await supabase.from("sites").select("count").limit(1);

    console.log("Database query result:", { data, error });

    if (error) {
      console.error("Database connection error:", error);
      return NextResponse.json(
        {
          status: "error",
          database: "disconnected",
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
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
