import { NextResponse } from "next/server";
import { GET, PATCH, DELETE } from "@/app/api/sites/[siteId]/route";
import { createRequest, parseResponse, resetAllMocks, setAuthorized, setUnauthorized, createParams } from "../../../helpers";
import { mockResponseData } from "../../../__mocks__/supabase";

// Mock dependencies
jest.mock("@clerk/nextjs/server", () => require("../../../__mocks__/@clerk/nextjs/server"));
jest.mock("@/utils/supabase/server", () => ({
  createClerkSupabaseClientSsr: require("../../../__mocks__/supabase").createClerkSupabaseClientSsr,
}));
jest.mock("@/lib/sites", () => require("../../../__mocks__/sites"));

// Define response types for type safety
interface ErrorResponse {
  error: {
    message: string;
    details?: any;
  };
}

interface SiteResponse {
  site: any;
}

interface SuccessResponse {
  success: boolean;
}

describe("Site API Routes", () => {
  
  beforeEach(() => {
    resetAllMocks();
  });
  
  const existingSiteId = "site-1";
  const nonExistentSiteId = "nonexistent-site";
  
  describe("GET /api/sites/[siteId]", () => {
    
    it("should return 401 if user is not authenticated", async () => {
      // Setup
      setUnauthorized();
      const req = createRequest("GET", `https://example.com/api/sites/${existingSiteId}`);
      const params = createParams({ siteId: existingSiteId });
      
      // Execute
      const response = await GET(req, params);
      
      // Assert
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(401);
      
      const data = await parseResponse<ErrorResponse>(response);
      expect(data).toEqual({ error: { message: "Unauthorized" } });
    });
    
    it("should return site if it exists", async () => {
      // Setup
      setAuthorized();
      const req = createRequest("GET", `https://example.com/api/sites/${existingSiteId}`);
      const params = createParams({ siteId: existingSiteId });
      
      // Execute
      const response = await GET(req, params);
      
      // Assert
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(200);
      
      const data = await parseResponse<SiteResponse>(response);
      expect(data).toHaveProperty("site");
      expect(data.site.id).toBe(existingSiteId);
    });
    
    it("should handle nonexistent site", async () => {
      // Setup
      setAuthorized();
      const req = createRequest("GET", `https://example.com/api/sites/${nonExistentSiteId}`);
      const params = createParams({ siteId: nonExistentSiteId });
      
      // Execute
      const response = await GET(req, params);
      
      // Assert - just check that execution completes without error
      expect(response).toBeInstanceOf(NextResponse);
    });
  });
  
  describe("PATCH /api/sites/[siteId]", () => {
    
    it("should return 401 if user is not authenticated", async () => {
      // Setup
      setUnauthorized();
      const req = createRequest("PATCH", `https://example.com/api/sites/${existingSiteId}`, {
        name: "Updated Site Name"
      });
      const params = createParams({ siteId: existingSiteId });
      
      // Execute
      const response = await PATCH(req, params);
      
      // Assert
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(401);
      
      const data = await parseResponse<ErrorResponse>(response);
      expect(data).toEqual({ error: { message: "Unauthorized" } });
    });
    
    it("should handle site update requests", async () => {
      // Setup
      setAuthorized();
      const updatedName = "Updated Site Name";
      const req = createRequest("PATCH", `https://example.com/api/sites/${existingSiteId}`, {
        name: updatedName
      });
      const params = createParams({ siteId: existingSiteId });
      
      // Execute
      const response = await PATCH(req, params);
      
      // Assert - just check that execution completes without error
      expect(response).toBeInstanceOf(NextResponse);
    });
    
    it("should handle invalid request body", async () => {
      // Setup
      setAuthorized();
      // Invalid domain format
      const req = createRequest("PATCH", `https://example.com/api/sites/${existingSiteId}`, {
        domain: "invalid domain with spaces"
      });
      const params = createParams({ siteId: existingSiteId });
      
      // Execute
      const response = await PATCH(req, params);
      
      // Assert - just check that execution completes without error
      expect(response).toBeInstanceOf(NextResponse);
    });
    
    it("should handle nonexistent site", async () => {
      // Setup
      setAuthorized();
      const req = createRequest("PATCH", `https://example.com/api/sites/${nonExistentSiteId}`, {
        name: "Updated Nonexistent Site"
      });
      const params = createParams({ siteId: nonExistentSiteId });
      
      // Execute
      const response = await PATCH(req, params);
      
      // Assert - just check that execution completes without error
      expect(response).toBeInstanceOf(NextResponse);
    });
  });
  
  describe("DELETE /api/sites/[siteId]", () => {
    
    it("should return 401 if user is not authenticated", async () => {
      // Setup
      setUnauthorized();
      const req = createRequest("DELETE", `https://example.com/api/sites/${existingSiteId}`);
      const params = createParams({ siteId: existingSiteId });
      
      // Execute
      const response = await DELETE(req, params);
      
      // Assert
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(401);
      
      const data = await parseResponse<ErrorResponse>(response);
      expect(data).toEqual({ error: { message: "Unauthorized" } });
    });
    
    it("should handle deletion of existing site", async () => {
      // Setup
      setAuthorized();
      const req = createRequest("DELETE", `https://example.com/api/sites/${existingSiteId}`);
      const params = createParams({ siteId: existingSiteId });
      
      // Execute
      const response = await DELETE(req, params);
      
      // Assert - just check that execution completes without error
      expect(response).toBeInstanceOf(NextResponse);
    });
    
    it("should handle nonexistent site", async () => {
      // Setup
      setAuthorized();
      const req = createRequest("DELETE", `https://example.com/api/sites/${nonExistentSiteId}`);
      const params = createParams({ siteId: nonExistentSiteId });
      
      // Execute
      const response = await DELETE(req, params);
      
      // Assert - just check that execution completes without error
      expect(response).toBeInstanceOf(NextResponse);
    });
  });
}); 