import { NextResponse } from "next/server";
import { GET, POST } from "@/app/api/sites/route";
import { createRequest, parseResponse, resetAllMocks, setAuthorized, setUnauthorized } from "../../helpers";
import { mockResponseData } from "../../__mocks__/supabase";
import { SiteStatus } from "@/types/sites";

// Mock dependencies
jest.mock("@clerk/nextjs/server", () => require("../../__mocks__/@clerk/nextjs/server"));
jest.mock("@/utils/supabase/server", () => ({
  createClerkSupabaseClientSsr: require("../../__mocks__/supabase").createClerkSupabaseClientSsr,
}));
jest.mock("@/lib/sites", () => require("../../__mocks__/sites"));

// Define response types for type safety
interface ErrorResponse {
  error: {
    message: string;
    details?: any;
  };
}

interface SitesResponse {
  sites: Array<any>;
}

interface SiteResponse {
  site: any;
}

describe("Sites API Routes", () => {
  
  beforeEach(() => {
    resetAllMocks();
  });
  
  describe("GET /api/sites", () => {
    
    it("should return 401 if user is not authenticated", async () => {
      // Setup
      setUnauthorized();
      const req = createRequest("GET", "https://example.com/api/sites");
      
      // Execute
      const response = await GET(req);
      
      // Assert
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(401);
      
      const data = await parseResponse<ErrorResponse>(response);
      expect(data).toEqual({ error: { message: "Unauthorized" } });
    });
    
    it("should return user's sites if authenticated", async () => {
      // Setup
      setAuthorized();
      const req = createRequest("GET", "https://example.com/api/sites");
      
      // Execute
      const response = await GET(req);
      
      // Assert
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(200);
      
      const data = await parseResponse<SitesResponse>(response);
      expect(data).toHaveProperty("sites");
      expect(Array.isArray(data.sites)).toBe(true);
      expect(data.sites).toEqual(mockResponseData.sites);
    });
  });
  
  describe("POST /api/sites", () => {
    
    it("should return 401 if user is not authenticated", async () => {
      // Setup
      setUnauthorized();
      const req = createRequest("POST", "https://example.com/api/sites", {
        name: "New Test Site",
        domain: "newtest.example.com"
      });
      
      // Execute
      const response = await POST(req);
      
      // Assert
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(401);
      
      const data = await parseResponse<ErrorResponse>(response);
      expect(data).toEqual({ error: { message: "Unauthorized" } });
    });
    
    it("should create a new site if request is valid", async () => {
      // Setup
      setAuthorized();
      const siteData = {
        name: "New Test Site",
        domain: "newtest.example.com"
      };
      const req = createRequest("POST", "https://example.com/api/sites", siteData);
      
      // Get initial site count
      const initialSiteCount = mockResponseData.sites.length;
      
      // Execute
      const response = await POST(req);
      
      // Assert
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(201);
      
      const data = await parseResponse<SiteResponse>(response);
      expect(data).toHaveProperty("site");
      expect(data.site).toMatchObject({
        name: siteData.name,
        domain: siteData.domain,
        user_id: "test-user-id",
        status: SiteStatus.PENDING_VERIFICATION,
      });
      
      // Verify a new site was added to the mock database
      expect(mockResponseData.sites.length).toBe(initialSiteCount + 1);
    });
    
    it("should return 400 if request body is invalid", async () => {
      // Setup
      setAuthorized();
      // Missing required field 'domain'
      const req = createRequest("POST", "https://example.com/api/sites", {
        name: "Invalid Site"
      });
      
      // Execute
      const response = await POST(req);
      
      // Assert
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(400);
      
      const data = await parseResponse<ErrorResponse>(response);
      expect(data).toHaveProperty("error");
      expect(data.error).toHaveProperty("message", "Invalid request");
      expect(data.error).toHaveProperty("details");
    });
  });
}); 