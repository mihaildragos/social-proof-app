import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { FileDatabase } from "@/lib/storage/file-db";

// Use real Supabase for both development and production
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function createClerkSupabaseClientSsr() {
  console.log("🔗 Creating Supabase client for:", process.env.NODE_ENV);

  // If no Supabase credentials, use file database for development
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log("📁 No Supabase credentials found, using file database for development");
    
    return {
      from: (table: string) => {
        console.log(`📁 FileDB: Accessing table '${table}'`);
        if (table === 'sites') {
          return FileDatabase.sites();
        } else if (table === 'integrations') {
          return FileDatabase.integrations();
        }
        
        // Default fallback for other tables
        return {
          select: () => ({ then: async (callback: any) => callback({ data: [], error: null }) }),
          insert: () => ({ 
            select: () => ({ 
              single: async () => ({ data: null, error: { message: `Table ${table} not implemented in file DB` }}) 
            }) 
          })
        };
      }
    } as any;
  }

  console.log("🔗 Supabase URL:", SUPABASE_URL?.substring(0, 30) + "...");

  try {
    // Try to get Clerk token for user-authenticated requests
    const { getToken } = await auth();
    const clerkToken = await getToken({
      template: "supabase",
    });

    if (clerkToken) {
      console.log("✅ Using Clerk token for authenticated request");
      return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        global: {
          fetch: async (url, options = {}) => {
            const headers = new Headers(options?.headers);
            headers.set("Authorization", `Bearer ${clerkToken}`);

            return fetch(url, {
              ...options,
              headers,
            });
          },
        },
      });
    }
  } catch (error) {
    console.log("🔒 No Clerk token available, using service role key");
  }

  // Fallback to service role key for server-side operations
  console.log("🔑 Using Supabase service role key");
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
