import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { organizationService } from "../../services/organizationService";
import { db } from "../../utils/db";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../../middleware/errorHandler";

// Mock the database module
jest.mock("../../utils/db");
const mockDb = db as jest.Mocked<typeof db>;

// Mock the logger
jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("OrganizationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createOrganization", () => {
    const mockParams = {
      name: "Test Organization",
      slug: "test-org",
      dataRegion: "us-east-1",
      userId: "user-123",
    };

    it("should create organization successfully", async () => {
      const mockOrganization = {
        id: "org-123",
        name: "Test Organization",
        slug: "test-org",
        data_region: "us-east-1",
        settings: {},
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockDb.getOne
        .mockResolvedValueOnce(null) // No existing organization with slug
        .mockResolvedValueOnce(mockOrganization); // Created organization
      mockDb.execute.mockResolvedValueOnce(1); // Member insertion

      const result = await organizationService.createOrganization(mockParams);

      expect(result).toEqual({
        id: "org-123",
        name: "Test Organization",
        slug: "test-org",
        dataRegion: "us-east-1",
        settings: {},
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      });

      expect(mockDb.getOne).toHaveBeenCalledWith("SELECT id FROM organizations WHERE slug = $1", [
        "test-org",
      ]);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO organization_members"),
        ["user-123", "org-123", "owner"]
      );
    });

    it("should throw error if slug already exists", async () => {
      mockDb.getOne.mockResolvedValueOnce({ id: "existing-org" });

      await expect(organizationService.createOrganization(mockParams)).rejects.toThrow(
        "Organization slug is already taken"
      );
    });

    it("should throw error if organization creation fails", async () => {
      mockDb.getOne
        .mockResolvedValueOnce(null) // No existing organization
        .mockResolvedValueOnce(null); // Failed to create organization

      await expect(organizationService.createOrganization(mockParams)).rejects.toThrow(
        "Failed to create organization"
      );
    });
  });

  describe("getOrganization", () => {
    const organizationId = "org-123";
    const userId = "user-123";

    it("should get organization successfully", async () => {
      const mockMembership = { role: "admin" };
      const mockOrganization = {
        id: "org-123",
        name: "Test Organization",
        slug: "test-org",
        data_region: "us-east-1",
        settings: {},
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockDb.getOne.mockResolvedValueOnce(mockMembership).mockResolvedValueOnce(mockOrganization);

      const result = await organizationService.getOrganization(organizationId, userId);

      expect(result).toEqual({
        id: "org-123",
        name: "Test Organization",
        slug: "test-org",
        dataRegion: "us-east-1",
        settings: {},
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      });
    });

    it("should throw unauthorized error if user is not a member", async () => {
      mockDb.getOne.mockResolvedValueOnce(null);

      await expect(organizationService.getOrganization(organizationId, userId)).rejects.toThrow(
        "Not authorized to access this organization"
      );
    });

    it("should return null if organization not found", async () => {
      const mockMembership = { role: "admin" };
      mockDb.getOne.mockResolvedValueOnce(mockMembership).mockResolvedValueOnce(null);

      const result = await organizationService.getOrganization(organizationId, userId);

      expect(result).toBeNull();
    });
  });

  describe("updateOrganization", () => {
    const organizationId = "org-123";
    const userId = "user-123";
    const updateParams = {
      name: "Updated Organization",
      settings: { theme: "dark" },
    };

    it("should update organization successfully", async () => {
      const mockMembership = { role: "owner" };
      const mockUpdatedOrganization = {
        id: "org-123",
        name: "Updated Organization",
        slug: "test-org",
        data_region: "us-east-1",
        settings: { theme: "dark" },
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T01:00:00Z",
      };

      mockDb.getOne
        .mockResolvedValueOnce(mockMembership)
        .mockResolvedValueOnce(mockUpdatedOrganization);

      const result = await organizationService.updateOrganization(
        organizationId,
        updateParams,
        userId
      );

      expect(result.name).toBe("Updated Organization");
      expect(result.settings).toEqual({ theme: "dark" });
    });

    it("should throw unauthorized error if user is not admin or owner", async () => {
      const mockMembership = { role: "member" };
      mockDb.getOne.mockResolvedValueOnce(mockMembership);

      await expect(
        organizationService.updateOrganization(organizationId, updateParams, userId)
      ).rejects.toThrow("Not authorized to update this organization");
    });

    it("should throw error if update fails", async () => {
      const mockMembership = { role: "owner" };
      mockDb.getOne.mockResolvedValueOnce(mockMembership).mockResolvedValueOnce(null);

      await expect(
        organizationService.updateOrganization(organizationId, updateParams, userId)
      ).rejects.toThrow("Failed to update organization");
    });
  });

  describe("listUserOrganizations", () => {
    const userId = "user-123";

    it("should list user organizations successfully", async () => {
      const mockOrganizations = [
        {
          id: "org-1",
          name: "Organization 1",
          slug: "org-1",
          data_region: "us-east-1",
          settings: {},
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "org-2",
          name: "Organization 2",
          slug: "org-2",
          data_region: "us-west-2",
          settings: {},
          created_at: "2024-01-02T00:00:00Z",
          updated_at: "2024-01-02T00:00:00Z",
        },
      ];

      mockDb.getMany.mockResolvedValueOnce(mockOrganizations);

      const result = await organizationService.listUserOrganizations(userId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Organization 1");
      expect(result[1].name).toBe("Organization 2");
    });

    it("should return empty array if user has no organizations", async () => {
      mockDb.getMany.mockResolvedValueOnce([]);

      const result = await organizationService.listUserOrganizations(userId);

      expect(result).toEqual([]);
    });
  });

  describe("listOrganizationMembers", () => {
    const organizationId = "org-123";
    const userId = "user-123";

    it("should list organization members successfully", async () => {
      const mockMembership = { role: "admin" };
      const mockMembers = [
        {
          id: "member-1",
          user_id: "user-1",
          organization_id: "org-123",
          role: "owner",
          joined_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "member-2",
          user_id: "user-2",
          organization_id: "org-123",
          role: "admin",
          joined_at: "2024-01-02T00:00:00Z",
        },
      ];

      mockDb.getOne.mockResolvedValueOnce(mockMembership);
      mockDb.getMany.mockResolvedValueOnce(mockMembers);

      const result = await organizationService.listOrganizationMembers(organizationId, userId);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe("owner");
      expect(result[1].role).toBe("admin");
    });

    it("should throw unauthorized error if user is not a member", async () => {
      mockDb.getOne.mockResolvedValueOnce(null);

      await expect(
        organizationService.listOrganizationMembers(organizationId, userId)
      ).rejects.toThrow("Not authorized to access this organization");
    });
  });

  describe("updateMemberRole", () => {
    const organizationId = "org-123";
    const memberId = "user-456";
    const newRole = "admin";
    const userId = "user-123";

    it("should update member role successfully", async () => {
      const mockUserMembership = { role: "owner" };
      const mockTargetMember = { role: "member", user_id: "user-456" };

      mockDb.getOne
        .mockResolvedValueOnce(mockUserMembership)
        .mockResolvedValueOnce(mockTargetMember);
      mockDb.execute.mockResolvedValueOnce(1);

      await organizationService.updateMemberRole(organizationId, memberId, newRole, userId);

      expect(mockDb.execute).toHaveBeenCalledWith(
        "UPDATE organization_members SET role = $1 WHERE organization_id = $2 AND user_id = $3",
        [newRole, organizationId, memberId]
      );
    });

    it("should throw unauthorized error if user is not admin or owner", async () => {
      const mockUserMembership = { role: "member" };
      mockDb.getOne.mockResolvedValueOnce(mockUserMembership);

      await expect(
        organizationService.updateMemberRole(organizationId, memberId, newRole, userId)
      ).rejects.toThrow("Not authorized to update member roles");
    });

    it("should throw error if target member not found", async () => {
      const mockUserMembership = { role: "owner" };
      mockDb.getOne.mockResolvedValueOnce(mockUserMembership).mockResolvedValueOnce(null);

      await expect(
        organizationService.updateMemberRole(organizationId, memberId, newRole, userId)
      ).rejects.toThrow("Member not found");
    });

    it("should throw error if non-owner tries to change owner role", async () => {
      const mockUserMembership = { role: "admin" };
      const mockTargetMember = { role: "owner", user_id: "user-456" };

      mockDb.getOne
        .mockResolvedValueOnce(mockUserMembership)
        .mockResolvedValueOnce(mockTargetMember);

      await expect(
        organizationService.updateMemberRole(organizationId, memberId, newRole, userId)
      ).rejects.toThrow("Only owners can change owner roles");
    });
  });

  describe("removeMember", () => {
    const organizationId = "org-123";
    const memberId = "user-456";
    const userId = "user-123";

    it("should remove member successfully", async () => {
      const mockUserMembership = { role: "owner" };
      const mockTargetMember = { role: "member" };

      mockDb.getOne
        .mockResolvedValueOnce(mockUserMembership)
        .mockResolvedValueOnce(mockTargetMember);
      mockDb.execute.mockResolvedValueOnce(1);

      await organizationService.removeMember(organizationId, memberId, userId);

      expect(mockDb.execute).toHaveBeenCalledWith(
        "DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        [organizationId, memberId]
      );
    });

    it("should throw unauthorized error if user is not admin or owner", async () => {
      const mockUserMembership = { role: "member" };
      mockDb.getOne.mockResolvedValueOnce(mockUserMembership);

      await expect(
        organizationService.removeMember(organizationId, memberId, userId)
      ).rejects.toThrow("Not authorized to remove members");
    });

    it("should throw error if target member not found", async () => {
      const mockUserMembership = { role: "owner" };
      mockDb.getOne.mockResolvedValueOnce(mockUserMembership).mockResolvedValueOnce(null);

      await expect(
        organizationService.removeMember(organizationId, memberId, userId)
      ).rejects.toThrow("Member not found");
    });

    it("should throw error if non-owner tries to remove owner", async () => {
      const mockUserMembership = { role: "admin" };
      const mockTargetMember = { role: "owner" };

      mockDb.getOne
        .mockResolvedValueOnce(mockUserMembership)
        .mockResolvedValueOnce(mockTargetMember);

      await expect(
        organizationService.removeMember(organizationId, memberId, userId)
      ).rejects.toThrow("Only owners can remove other owners");
    });
  });
});
 