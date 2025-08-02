import { NextResponse } from "next/server";
import { createClerkSupabaseClientSsr } from "@/utils/supabase/server";

export async function GET() {
  try {
    console.log("🔍 DEBUG: Checking database contents");
    
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: "Debug endpoint only available in development" }, { status: 403 });
    }

    const supabase = await createClerkSupabaseClientSsr();

    // Check sites table
    const { data: sites, error: sitesError } = await supabase
      .from("sites")
      .select("*")
      .order('created_at', { ascending: false })
      .limit(5);

    console.log("Sites in database:", sites);
    console.log("Sites query error:", sitesError);

    // Check integrations table
    const { data: integrations, error: integrationsError } = await supabase
      .from("integrations")
      .select("*")
      .order('created_at', { ascending: false })
      .limit(5);

    console.log("Integrations in database:", integrations);
    console.log("Integrations query error:", integrationsError);

    return NextResponse.json({
      debug: true,
      timestamp: new Date().toISOString(),
      sites: {
        data: sites,
        error: sitesError,
        count: sites?.length || 0
      },
      integrations: {
        data: integrations,
        error: integrationsError,
        count: integrations?.length || 0
      }
    });

  } catch (error: any) {
    console.error("🔍 DEBUG: Database check error:", error);
    return NextResponse.json({
      debug: true,
      error: error.message
    }, { status: 500 });
  }
} 