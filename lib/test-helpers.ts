/**
 * Test site and integration management utilities
 * Handles creation and management of test sites for end-to-end testing
 */

import { createClerkSupabaseClientSsr } from "@/utils/supabase/server";
import { randomBytes } from "crypto";
import { SiteStatus } from "@/types/sites";

export interface TestSite {
  id: string;
  name: string;
  domain: string;
  shop_domain: string;
  integration_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TestSiteCreationResult {
  success: boolean;
  site?: TestSite;
  error?: string;
}

/**
 * Generate a unique test site domain for a user
 * @param userId - User ID
 * @returns Test site domain
 */
export function generateTestSiteDomain(userId: string): string {
  const userHash = userId.slice(-8); // Last 8 characters of user ID
  const randomSuffix = randomBytes(4).toString("hex");
  return `test-site-${userHash}-${randomSuffix}.example.com`;
}

/**
 * Generate a unique test shop domain for Shopify integration
 * @param userId - User ID
 * @returns Test shop domain
 */
export function generateTestShopDomain(userId: string): string {
  const userHash = userId.slice(-8); // Last 8 characters of user ID
  const randomSuffix = randomBytes(4).toString("hex");
  return `test-store-${userHash}-${randomSuffix}.myshopify.com`;
}

/**
 * Create a test site with Shopify integration
 * @param userId - User ID
 * @param userName - User's display name
 * @returns Test site creation result
 */
export async function createTestSiteWithIntegration(
  userId: string,
  userName?: string
): Promise<TestSiteCreationResult> {
  try {
    console.log(`=== Creating Test Site for User: ${userId} ===`);
    const supabase = await createClerkSupabaseClientSsr();

    // Generate unique domains
    const siteDomain = generateTestSiteDomain(userId);
    const shopDomain = generateTestShopDomain(userId);
    const siteName = `Test Site - ${userName || "User"}`;

    console.log(`Generated domains:
      - Site Domain: ${siteDomain}
      - Shop Domain: ${shopDomain}
      - Site Name: ${siteName}`);

    // Start a transaction by creating the site first
    console.log("Creating site in database...");
    const { data: siteData, error: siteError } = await supabase
      .from("sites")
      .insert({
        owner_id: userId,
        name: siteName,
        domain: siteDomain,
        status: SiteStatus.VERIFIED, // Auto-verify for testing
        verification_token: randomBytes(32).toString("hex"),
        settings: {
          is_test_site: true,
          created_by_test_panel: true,
          test_shop_domain: shopDomain,
          auto_verify: true,
        },
      })
      .select()
      .single();

    if (siteError || !siteData) {
      console.error("❌ Error creating test site:", siteError);
      return {
        success: false,
        error: `Failed to create test site: ${siteError?.message || "Unknown error"}`,
      };
    }

    console.log(`✅ Site created successfully: ${siteData.id}`);

    // Create Shopify integration for the site
    console.log("Creating Shopify integration...");
    const { data: integrationData, error: integrationError } = await supabase
      .from("integrations")
      .insert({
        site_id: siteData.id,
        provider: "shopify",
        name: `Test Shopify Integration - ${userName || "User"}`,
        status: "active",
        settings: {
          shop_domain: shopDomain,
          is_test_integration: true,
          created_by_test_panel: true,
          auto_webhooks: true,
        },
        webhook_url: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3007"}/api/webhooks/shopify/orders/create`,
        webhook_secret: process.env.SHOPIFY_WEBHOOK_SECRET || "mock_shopify_webhook_secret",
      })
      .select()
      .single();

    if (integrationError || !integrationData) {
      console.error("❌ Error creating test integration:", integrationError);

      // Clean up the site if integration creation failed
      console.log("Cleaning up site due to integration failure...");
      await supabase.from("sites").delete().eq("id", siteData.id);

      return {
        success: false,
        error: `Failed to create test integration: ${integrationError?.message || "Unknown error"}`,
      };
    }

    console.log(`✅ Integration created successfully: ${integrationData.id}`);

    const testSite: TestSite = {
      id: siteData.id,
      name: siteData.name,
      domain: siteData.domain,
      shop_domain: shopDomain,
      integration_id: integrationData.id,
      status: siteData.status,
      created_at: siteData.created_at,
      updated_at: siteData.updated_at,
    };

    console.log(`🎉 Test site creation completed:`, testSite);

    return {
      success: true,
      site: testSite,
    };
  } catch (error: any) {
    console.error("💥 Unexpected error creating test site:", error);
    return {
      success: false,
      error: `Unexpected error: ${error.message}`,
    };
  }
}

/**
 * Get or create a test site for a user (reuses existing if found)
 * @param userId - User ID
 * @param userName - User's display name
 * @returns Test site
 */
export async function getOrCreateTestSite(
  userId: string,
  userName?: string
): Promise<TestSiteCreationResult> {
  try {
    const supabase = await createClerkSupabaseClientSsr();

    // First, try to find existing test site
    const { data: existingSites, error: searchError } = await supabase
      .from("sites")
      .select(
        `
        *,
        integrations!inner(
          id,
          provider,
          status,
          settings
        )
      `
      )
      .eq("owner_id", userId)
      .eq("settings->is_test_site", true)
      .eq("integrations.provider", "shopify")
      .eq("integrations.status", "active")
      .limit(1);

    if (searchError) {
      console.error("Error searching for existing test site:", searchError);
      // Continue to create new site if search fails
    } else if (existingSites && existingSites.length > 0) {
      const existingSite = existingSites[0];
      const integration = existingSite.integrations[0];

      const testSite: TestSite = {
        id: existingSite.id,
        name: existingSite.name,
        domain: existingSite.domain,
        shop_domain: integration.settings?.shop_domain || "unknown",
        integration_id: integration.id,
        status: existingSite.status,
        created_at: existingSite.created_at,
        updated_at: existingSite.updated_at,
      };

      console.log(`Found existing test site for user ${userId}: ${testSite.id}`);

      return {
        success: true,
        site: testSite,
      };
    }

    // No existing site found, create new one
    return await createTestSiteWithIntegration(userId, userName);
  } catch (error: any) {
    console.error("Error in getOrCreateTestSite:", error);
    return {
      success: false,
      error: `Error getting or creating test site: ${error.message}`,
    };
  }
}

/**
 * Delete a test site and its integrations
 * @param siteId - Site ID to delete
 * @param userId - User ID (for security)
 * @returns Success status
 */
export async function deleteTestSite(siteId: string, userId: string): Promise<boolean> {
  try {
    const supabase = await createClerkSupabaseClientSsr();

    // Verify ownership and that it's a test site
    const { data: site, error: fetchError } = await supabase
      .from("sites")
      .select("owner_id, settings")
      .eq("id", siteId)
      .single();

    if (fetchError || !site) {
      console.error("Test site not found or error fetching:", fetchError);
      return false;
    }

    if (site.owner_id !== userId) {
      console.error("User does not own this test site");
      return false;
    }

    if (!site.settings?.is_test_site) {
      console.error("Site is not marked as a test site, refusing to delete");
      return false;
    }

    // Delete the site (cascade will handle integrations)
    const { error: deleteError } = await supabase
      .from("sites")
      .delete()
      .eq("id", siteId)
      .eq("owner_id", userId);

    if (deleteError) {
      console.error("Error deleting test site:", deleteError);
      return false;
    }

    console.log(`Deleted test site ${siteId} for user ${userId}`);
    return true;
  } catch (error: any) {
    console.error("Unexpected error deleting test site:", error);
    return false;
  }
}

/**
 * Clean up old test sites for a user (keeps only the most recent)
 * @param userId - User ID
 * @param keepCount - Number of recent test sites to keep (default: 1)
 * @returns Number of sites cleaned up
 */
export async function cleanupOldTestSites(userId: string, keepCount: number = 1): Promise<number> {
  try {
    const supabase = await createClerkSupabaseClientSsr();

    // Get all test sites for user, ordered by creation date
    const { data: testSites, error: fetchError } = await supabase
      .from("sites")
      .select("id, created_at")
      .eq("owner_id", userId)
      .eq("settings->is_test_site", true)
      .order("created_at", { ascending: false });

    if (fetchError || !testSites) {
      console.error("Error fetching test sites for cleanup:", fetchError);
      return 0;
    }

    // If we have more sites than we want to keep
    if (testSites.length > keepCount) {
      const sitesToDelete = testSites.slice(keepCount);
      let deletedCount = 0;

      for (const site of sitesToDelete) {
        const deleted = await deleteTestSite(site.id, userId);
        if (deleted) {
          deletedCount++;
        }
      }

      console.log(`Cleaned up ${deletedCount} old test sites for user ${userId}`);
      return deletedCount;
    }

    return 0;
  } catch (error: any) {
    console.error("Error cleaning up old test sites:", error);
    return 0;
  }
}

/**
 * Validate that a test site exists and is properly configured
 * @param siteId - Site ID to validate
 * @param userId - User ID (for ownership verification)
 * @returns Validation result with any issues found
 */
export async function validateTestSite(
  siteId: string,
  userId: string
): Promise<{
  valid: boolean;
  issues: string[];
  site?: TestSite;
}> {
  const issues: string[] = [];

  try {
    const supabase = await createClerkSupabaseClientSsr();

    // Get site with integration
    const { data: siteData, error: siteError } = await supabase
      .from("sites")
      .select(
        `
        *,
        integrations!inner(
          id,
          provider,
          status,
          settings
        )
      `
      )
      .eq("id", siteId)
      .eq("owner_id", userId)
      .single();

    if (siteError || !siteData) {
      issues.push("Site not found or access denied");
      return { valid: false, issues };
    }

    // Check if it's a test site
    if (!siteData.settings?.is_test_site) {
      issues.push("Site is not marked as a test site");
    }

    // Check site status
    if (siteData.status !== SiteStatus.VERIFIED) {
      issues.push(`Site status is ${siteData.status}, expected ${SiteStatus.VERIFIED}`);
    }

    // Check integration
    const integration = siteData.integrations?.[0];
    if (!integration) {
      issues.push("No integration found for site");
    } else {
      if (integration.provider !== "shopify") {
        issues.push(`Integration provider is ${integration.provider}, expected shopify`);
      }
      if (integration.status !== "active") {
        issues.push(`Integration status is ${integration.status}, expected active`);
      }
      if (!integration.settings?.is_test_integration) {
        issues.push("Integration is not marked as a test integration");
      }
    }

    const testSite: TestSite = {
      id: siteData.id,
      name: siteData.name,
      domain: siteData.domain,
      shop_domain: integration?.settings?.shop_domain || "",
      integration_id: integration?.id || "",
      status: siteData.status,
      created_at: siteData.created_at,
      updated_at: siteData.updated_at,
    };

    return {
      valid: issues.length === 0,
      issues,
      site: testSite,
    };
  } catch (error: any) {
    issues.push(`Validation error: ${error.message}`);
    return { valid: false, issues };
  }
}
