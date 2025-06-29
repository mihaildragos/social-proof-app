import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { organizationService } from "../../services/organizationService";
import { prisma } from "../../lib/prisma";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../../middleware/errorHandler";

// Mock the Prisma module
jest.mock("../../lib/prisma", () => ({
  prisma: {
    organization: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    organizationMember: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Mock the logger
jest.mock("../../utils/logger");

describe("Users Service - Organization Management (PostgreSQL + Prisma Architecture)", () => {
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
        dataRegion: "us-east-1",
        settings: "{}",
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T00:00:00.000Z",
      };

      (mockPrisma.organization.findUnique as jest.Mock).mockResolvedValueOnce(null); // No existing organization with slug
      (mockPrisma.organization.create as jest.Mock).mockResolvedValueOnce(mockOrganization); // Created organization
      (mockPrisma.organizationMember.create as jest.Mock).mockResolvedValueOnce({ id: 1 }); // Member insertion

      const result = await organizationService.createOrganization(mockParams);

      expect(result).toEqual({
        id: "org-123",
        name: "Test Organization",
        slug: "test-org",
        dataRegion: "us-east-1",
        settings: "{}",
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T00:00:00.000Z",
      });

      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { slug: "test-org" },
      });
      expect(mockPrisma.organizationMember.create).toHaveBeenCalledWith({
        data: {
          userId: "user-123",
          organizationId: "org-123",
          role: "owner",
          joinedAt: expect.any(String),
        },
      });
    });

    it("should throw error if slug already exists", async () => {
      (mockPrisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({ id: "existing-org" });

      await expect(organizationService.createOrganization(mockParams)).rejects.toThrow(
        "Organization slug is already taken"
      );
    });

    it("should throw error if organization creation fails", async () => {
      (mockPrisma.organization.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (mockPrisma.organization.create as jest.Mock).mockResolvedValueOnce(null);

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
        dataRegion: "us-east-1",
        settings: {},
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      (mockPrisma.organizationMember.findFirst as jest.Mock).mockResolvedValueOnce(mockMembership);
      (mockPrisma.organization.findUnique as jest.Mock).mockResolvedValueOnce(mockOrganization);

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
      (mockPrisma.organizationMember.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(organizationService.getOrganization(organizationId, userId)).rejects.toThrow(
        "Not authorized to access this organization"
      );
    });

    it("should return null if organization not found", async () => {
      const mockMembership = { role: "admin" };
      (mockPrisma.organizationMember.findFirst as jest.Mock).mockResolvedValueOnce(mockMembership);
      (mockPrisma.organization.findUnique as jest.Mock).mockResolvedValueOnce(null);

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
        dataRegion: "us-east-1",
        settings: { theme: "dark" },
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T01:00:00Z",
      };

      (mockPrisma.organizationMember.findFirst as jest.Mock).mockResolvedValueOnce(mockMembership);
      (mockPrisma.organization.update as jest.Mock).mockResolvedValueOnce(mockUpdatedOrganization);

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
      (mockPrisma.organizationMember.findFirst as jest.Mock).mockResolvedValueOnce(mockMembership);

      await expect(
        organizationService.updateOrganization(organizationId, updateParams, userId)
      ).rejects.toThrow("Not authorized to update this organization");
    });

    it("should throw error if update fails", async () => {
      const mockMembership = { role: "owner" };
      (mockPrisma.organizationMember.findFirst as jest.Mock).mockResolvedValueOnce(mockMembership);
      (mockPrisma.organization.update as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        organizationService.updateOrganization(organizationId, updateParams, userId)
      ).rejects.toThrow("Failed to update organization");
    });
  });

  describe("listUserOrganizations", () => {
    const userId = "user-123";

    it("should list user organizations successfully", async () => {
      const mockMemberships = [
        {
          organization: {
            id: "org-1",
            name: "Organization 1",
            slug: "org-1",
            dataRegion: "us-east-1",
            settings: {},
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        },
        {
          organization: {
            id: "org-2",
            name: "Organization 2",
            slug: "org-2",
            dataRegion: "us-west-2",
            settings: {},
            createdAt: "2024-01-02T00:00:00Z",
            updatedAt: "2024-01-02T00:00:00Z",
          },
        },
      ];

      (mockPrisma.organizationMember.findMany as jest.Mock).mockResolvedValueOnce(mockMemberships);

      const result = await organizationService.listUserOrganizations(userId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Organization 1");
      expect(result[1].name).toBe("Organization 2");
    });

    it("should return empty array if user has no organizations", async () => {
      (mockPrisma.organizationMember.findMany as jest.Mock).mockResolvedValueOnce([]);

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
          userId: "user-1",
          organizationId: "org-123",
          role: "owner",
          joinedAt: "2024-01-01T00:00:00Z",
          user: {
            id: "user-1",
            email: "user1@example.com",
            fullName: "User One",
          },
        },
        {
          id: "member-2",
          userId: "user-2",
          organizationId: "org-123",
          role: "admin",
          joinedAt: "2024-01-02T00:00:00Z",
          user: {
            id: "user-2",
            email: "user2@example.com",
            fullName: "User Two",
          },
        },
      ];

      (mockPrisma.organizationMember.findFirst as jest.Mock).mockResolvedValueOnce(mockMembership);
      (mockPrisma.organizationMember.findMany as jest.Mock).mockResolvedValueOnce(mockMembers);

      const result = await organizationService.listOrganizationMembers(organizationId, userId);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe("owner");
      expect(result[1].role).toBe("admin");
    });

    it("should throw unauthorized error if user is not a member", async () => {
      (mockPrisma.organizationMember.findFirst as jest.Mock).mockResolvedValueOnce(null);

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
      const mockTargetMember = { role: "member", userId: "user-456" };

      (mockPrisma.organizationMember.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockUserMembership)
        .mockResolvedValueOnce(mockTargetMember);
      (mockPrisma.organizationMember.update as jest.Mock).mockResolvedValueOnce({ id: 1 });

      await organizationService.updateMemberRole(organizationId, memberId, newRole, userId);

      expect(mockPrisma.organizationMember.update).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            organizationId: organizationId,
            userId: memberId,
          },
        },
        data: {
          role: newRole,
        },
      });
    });

    it("should throw unauthorized error if user is not admin or owner", async () => {
      const mockUserMembership = { role: "member" };
      (mockPrisma.organizationMember.findFirst as jest.Mock).mockResolvedValueOnce(mockUserMembership);

      await expect(
        organizationService.updateMemberRole(organizationId, memberId, newRole, userId)
      ).rejects.toThrow("Not authorized to update member roles");
    });

    it("should throw error if target member not found", async () => {
      const mockUserMembership = { role: "owner" };
      (mockPrisma.organizationMember.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockUserMembership)
        .mockResolvedValueOnce(null);

      await expect(
        organizationService.updateMemberRole(organizationId, memberId, newRole, userId)
      ).rejects.toThrow("Member not found");
    });

    it("should throw error if non-owner tries to change owner role", async () => {
      const mockUserMembership = { role: "admin" };
      const mockTargetMember = { role: "owner", userId: "user-456" };

      (mockPrisma.organizationMember.findFirst as jest.Mock)
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

      (mockPrisma.organizationMember.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockUserMembership)
        .mockResolvedValueOnce(mockTargetMember);
      (mockPrisma.organizationMember.delete as jest.Mock).mockResolvedValueOnce({ id: 1 });

      await organizationService.removeMember(organizationId, memberId, userId);

      expect(mockPrisma.organizationMember.delete).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            organizationId: organizationId,
            userId: memberId,
          },
        },
      });
    });

    it("should throw unauthorized error if user is not admin or owner", async () => {
      const mockUserMembership = { role: "member" };
      (mockPrisma.organizationMember.findFirst as jest.Mock).mockResolvedValueOnce(mockUserMembership);

      await expect(
        organizationService.removeMember(organizationId, memberId, userId)
      ).rejects.toThrow("Not authorized to remove members");
    });

    it("should throw error if target member not found", async () => {
      const mockUserMembership = { role: "owner" };
      (mockPrisma.organizationMember.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockUserMembership)
        .mockResolvedValueOnce(null);

      await expect(
        organizationService.removeMember(organizationId, memberId, userId)
      ).rejects.toThrow("Member not found");
    });

    it("should throw error if non-owner tries to remove owner", async () => {
      const mockUserMembership = { role: "admin" };
      const mockTargetMember = { role: "owner" };

      (mockPrisma.organizationMember.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockUserMembership)
        .mockResolvedValueOnce(mockTargetMember);

      await expect(
        organizationService.removeMember(organizationId, memberId, userId)
      ).rejects.toThrow("Only owners can remove other owners");
    });
  });
});
 