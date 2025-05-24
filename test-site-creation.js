#!/usr/bin/env node
/**
 * Test Site Creation Script
 * Tests the test site creation API directly to debug the database issue
 */

const fetch = require("node-fetch");

async function testSiteCreation() {
  console.log("🧪 Testing Test Site Creation API...\n");

  try {
    // Test without authentication first to see what happens
    console.log("1. Testing API endpoint...");
    const response = await fetch("http://localhost:3007/api/test-control-panel/test-site", {
      method: "GET",
    });

    const data = await response.json();

    console.log("Response Status:", response.status);
    console.log("Response Data:", JSON.stringify(data, null, 2));

    if (response.status === 401) {
      console.log("\n✅ API is responding but requires authentication (as expected)");
      console.log("This confirms the API endpoint is working.");
    } else if (response.status === 200) {
      console.log("\n✅ Site creation successful!");
      if (data.site) {
        console.log("Site ID:", data.site.id);
        console.log("Shop Domain:", data.site.shop_domain);
      }
    } else {
      console.log("\n❌ Unexpected response");
    }
  } catch (error) {
    console.error("❌ Error testing site creation:", error.message);
  }

  console.log("\n2. Testing database connection...");

  try {
    // Test database connection through a simple endpoint
    const dbResponse = await fetch("http://localhost:3007/api/health", {
      method: "GET",
    });

    if (dbResponse.ok) {
      const dbData = await dbResponse.json();
      console.log("✅ Database connection test:", dbData);
    } else {
      console.log("❌ Database connection test failed:", dbResponse.status);
    }
  } catch (error) {
    console.log("❌ Database connection error:", error.message);
  }
}

// Run the test
testSiteCreation().catch(console.error);
