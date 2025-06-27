import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { invitationService } from "../../services/invitationService";
import { prisma } from "../../lib/prisma";

// Mock the Prisma module
jest.mock("../../lib/prisma", () => ({
  prisma: {
    invitation: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    organization: {
      findFirst: jest.fn(),
    },
    organizationMember: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Mock the logger
jest.mock("../../utils/logger");

describe("Users Service - Invitation Management (PostgreSQL + Prisma Architecture)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createInvitation", () => {
    const mockParams = {
      email: "test@example.com",
      organizationId: "org-123",
      role: "admin",
      invitedBy: "user-123",
    };

    it("should create invitation successfully", async () => {
      const mockMembership = { role: "owner" };
      const mockInvitation = {
        id: "invitation-123",
        email: "test@example.com",
        organizationId: "org-123",
        role: "admin",
        token: "mock-token-123",
        status: "pending",
        invitedBy: "user-123",
        createdAt: "2024-01-01T00:00:00Z",
        expiresAt: "2024-01-08T00:00:00Z",
      };
      const mockOrganization = {
        id: "org-123",
        name: "Test Organization",
        slug: "test-org",
      };

      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(mockMembership);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      mockPrisma.invitation.findFirst.mockResolvedValueOnce(null);
      mockPrisma.invitation.create.mockResolvedValueOnce(mockInvitation);
      mockPrisma.organization.findFirst.mockResolvedValueOnce(mockOrganization);

      const result = await invitationService.createInvitation(mockParams);

      expect(result).toEqual({
        id: "invitation-123",
        email: "test@example.com",
        organizationId: "org-123",
        role: "admin",
        token: "mock-token-123",
        status: "pending",
        invitedBy: "user-123",
        createdAt: "2024-01-01T00:00:00Z",
        expiresAt: "2024-01-08T00:00:00Z",
        organization: {
          id: "org-123",
          name: "Test Organization",
          slug: "test-org",
        },
      });
    });

    it("should throw unauthorized error if user cannot invite", async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce({ role: "member" });

      await expect(invitationService.createInvitation(mockParams)).rejects.toThrow(
        "Not authorized to send invitations"
      );
    });

    it("should throw error if user is already a member", async () => {
      const mockMembership = { role: "owner" };
      const mockExistingUser = { id: "existing-user" };

      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(mockMembership);
      mockPrisma.user.findFirst.mockResolvedValueOnce(mockExistingUser);

      await expect(invitationService.createInvitation(mockParams)).rejects.toThrow(
        "User is already a member of this organization"
      );
    });

    it("should throw error if invitation already exists", async () => {
      const mockMembership = { role: "owner" };
      const mockExistingInvitation = { id: "existing-invitation" };

      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(mockMembership);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null); // No existing user
      mockPrisma.invitation.findFirst.mockResolvedValueOnce(mockExistingInvitation);

      await expect(invitationService.createInvitation(mockParams)).rejects.toThrow(
        "Invitation already sent to this email"
      );
    });
  });

  describe("listOrganizationInvitations", () => {
    const organizationId = "org-123";
    const userId = "user-123";

    it("should list invitations successfully", async () => {
      const mockMembership = { role: "admin" };
      const mockInvitations = [
        {
          id: "invitation-1",
          email: "user1@example.com",
          organizationId: "org-123",
          role: "admin",
          token: "token-1",
          status: "pending",
          invitedBy: "user-123",
          createdAt: "2024-01-01T00:00:00Z",
          expiresAt: "2024-01-08T00:00:00Z",
          organization: {
            id: "org-123",
            name: "Test Organization",
            slug: "test-org",
          },
        },
        {
          id: "invitation-2",
          email: "user2@example.com",
          organizationId: "org-123",
          role: "member",
          token: "token-2",
          status: "accepted",
          invitedBy: "user-123",
          createdAt: "2024-01-02T00:00:00Z",
          expiresAt: "2024-01-09T00:00:00Z",
          organization: {
            id: "org-123",
            name: "Test Organization",
            slug: "test-org",
          },
        },
      ];

      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(mockMembership);
      mockPrisma.invitation.findMany.mockResolvedValueOnce(mockInvitations);

      const result = await invitationService.listOrganizationInvitations(organizationId, userId);

      expect(result).toHaveLength(2);
      expect(result[0].email).toBe("user1@example.com");
      expect(result[0].status).toBe("pending");
      expect(result[1].email).toBe("user2@example.com");
      expect(result[1].status).toBe("accepted");
    });

    it("should throw unauthorized error if user is not a member", async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(null);

      await expect(
        invitationService.listOrganizationInvitations(organizationId, userId)
      ).rejects.toThrow("Not authorized to access this organization");
    });
  });

  describe("verifyInvitationToken", () => {
    const token = "valid-token-123";

    it("should verify invitation token successfully", async () => {
      const mockInvitation = {
        id: "invitation-123",
        email: "test@example.com",
        organizationId: "org-123",
        role: "admin",
        token: "valid-token-123",
        status: "pending",
        invitedBy: "user-123",
        createdAt: "2024-01-01T00:00:00Z",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Future date
        organization: {
          id: "org-123",
          name: "Test Organization",
          slug: "test-org",
        },
      };

      mockPrisma.invitation.findFirst.mockResolvedValueOnce(mockInvitation);

      const result = await invitationService.verifyInvitationToken(token);

      expect(result.token).toBe("valid-token-123");
      expect(result.status).toBe("pending");
      expect(result.organization?.name).toBe("Test Organization");
    });

    it("should throw error if token is invalid", async () => {
      mockPrisma.invitation.findFirst.mockResolvedValueOnce(null);

      await expect(invitationService.verifyInvitationToken(token)).rejects.toThrow(
        "Invalid invitation token"
      );
    });

    it("should throw error if invitation is not pending", async () => {
      const mockInvitation = {
        id: "invitation-123",
        status: "accepted",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockPrisma.invitation.findFirst.mockResolvedValueOnce(mockInvitation);

      await expect(invitationService.verifyInvitationToken(token)).rejects.toThrow(
        "Invitation has already been used or cancelled"
      );
    });

    it("should throw error if invitation is expired", async () => {
      const mockInvitation = {
        id: "invitation-123",
        status: "pending",
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Past date
      };

      mockPrisma.invitation.findFirst.mockResolvedValueOnce(mockInvitation);

      await expect(invitationService.verifyInvitationToken(token)).rejects.toThrow(
        "Invitation has expired"
      );
    });
  });

  describe("acceptInvitation", () => {
    const mockInvitation = {
      id: "invitation-123",
      email: "test@example.com",
      organizationId: "org-123",
      role: "admin",
      token: "valid-token-123",
      status: "pending",
      invitedBy: "user-123",
      createdAt: "2024-01-01T00:00:00Z",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      organization: {
        id: "org-123",
        name: "Test Organization",
        slug: "test-org",
      },
    };

    it("should accept invitation for existing user", async () => {
      const mockParams = {
        token: "valid-token-123",
        user: { id: "existing-user-123" },
      };

      // Mock verifyInvitationToken
      jest.spyOn(invitationService, "verifyInvitationToken").mockResolvedValueOnce(mockInvitation);

      mockPrisma.organizationMember.create.mockResolvedValueOnce(1);

      const result = await invitationService.acceptInvitation(mockParams);

      expect(result).toEqual({
        message: "Invitation accepted successfully",
        organizationId: "org-123",
        role: "admin",
        userId: "existing-user-123",
      });

      expect(mockPrisma.organizationMember.create).toHaveBeenCalledWith({
        data: {
          userId: "existing-user-123",
          organizationId: "org-123",
          role: "admin",
          joinedAt: expect.any(Date),
        },
      });
    });

    it("should accept invitation for new user", async () => {
      const mockParams = {
        token: "valid-token-123",
        fullName: "New User",
        password: "password123",
      };

      const mockNewUser = { id: "new-user-123" };

      // Mock verifyInvitationToken
      jest.spyOn(invitationService, "verifyInvitationToken").mockResolvedValueOnce(mockInvitation);

      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce(mockNewUser);
      mockPrisma.organizationMember.create.mockResolvedValueOnce(1);

      const result = await invitationService.acceptInvitation(mockParams);

      expect(result.userId).toBe("new-user-123");
      expect(result.organizationId).toBe("org-123");
    });

    it("should throw error if new user data is missing", async () => {
      const mockParams = {
        token: "valid-token-123",
        // Missing fullName and password
      };

      // Mock verifyInvitationToken
      jest.spyOn(invitationService, "verifyInvitationToken").mockResolvedValueOnce(mockInvitation);

      await expect(invitationService.acceptInvitation(mockParams)).rejects.toThrow(
        "Full name and password are required for new users"
      );
    });

    it("should throw error if user already exists", async () => {
      const mockParams = {
        token: "valid-token-123",
        fullName: "New User",
        password: "password123",
      };

      const mockExistingUser = { id: "existing-user" };

      // Mock verifyInvitationToken
      jest.spyOn(invitationService, "verifyInvitationToken").mockResolvedValueOnce(mockInvitation);

      mockPrisma.user.findFirst.mockResolvedValueOnce(mockExistingUser);

      await expect(invitationService.acceptInvitation(mockParams)).rejects.toThrow(
        "User already exists. Please sign in to accept the invitation."
      );
    });
  });

  describe("cancelInvitation", () => {
    const invitationId = "invitation-123";
    const userId = "user-123";

    it("should cancel invitation successfully", async () => {
      const mockInvitation = {
        organizationId: "org-123",
        status: "pending",
      };
      const mockMembership = { role: "admin" };

      mockPrisma.invitation.findFirst.mockResolvedValueOnce(mockInvitation);
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(mockMembership);
      mockPrisma.invitation.update.mockResolvedValueOnce(1);

      await invitationService.cancelInvitation(invitationId, userId);

      expect(mockPrisma.invitation.update).toHaveBeenCalledWith({
        where: { id: invitationId },
        data: { status: "cancelled", cancelledAt: expect.any(Date) },
      });
    });

    it("should throw error if invitation not found", async () => {
      mockPrisma.invitation.findFirst.mockResolvedValueOnce(null);

      await expect(invitationService.cancelInvitation(invitationId, userId)).rejects.toThrow(
        "Invitation not found"
      );
    });

    it("should throw error if invitation is not pending", async () => {
      const mockInvitation = {
        organizationId: "org-123",
        status: "accepted",
      };

      mockPrisma.invitation.findFirst.mockResolvedValueOnce(mockInvitation);

      await expect(invitationService.cancelInvitation(invitationId, userId)).rejects.toThrow(
        "Can only cancel pending invitations"
      );
    });

    it("should throw unauthorized error if user cannot cancel", async () => {
      const mockInvitation = {
        organizationId: "org-123",
        status: "pending",
      };
      const mockMembership = { role: "member" };

      mockPrisma.invitation.findFirst.mockResolvedValueOnce(mockInvitation);
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(mockMembership);

      await expect(invitationService.cancelInvitation(invitationId, userId)).rejects.toThrow(
        "Not authorized to cancel invitations"
      );
    });
  });

  describe("resendInvitation", () => {
    const invitationId = "invitation-123";
    const userId = "user-123";

    it("should resend invitation successfully", async () => {
      const mockInvitation = {
        organizationId: "org-123",
        status: "pending",
        email: "test@example.com",
      };
      const mockMembership = { role: "admin" };

      mockPrisma.invitation.findFirst.mockResolvedValueOnce(mockInvitation);
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(mockMembership);
      mockPrisma.invitation.update.mockResolvedValueOnce(1);

      await invitationService.resendInvitation(invitationId, userId);

      expect(mockPrisma.invitation.update).toHaveBeenCalledWith({
        where: { id: invitationId },
        data: { expiresAt: expect.any(String) },
      });
    });

    it("should throw error if invitation not found", async () => {
      mockPrisma.invitation.findFirst.mockResolvedValueOnce(null);

      await expect(invitationService.resendInvitation(invitationId, userId)).rejects.toThrow(
        "Invitation not found"
      );
    });

    it("should throw error if invitation is not pending", async () => {
      const mockInvitation = {
        organizationId: "org-123",
        status: "accepted",
        email: "test@example.com",
      };

      mockPrisma.invitation.findFirst.mockResolvedValueOnce(mockInvitation);

      await expect(invitationService.resendInvitation(invitationId, userId)).rejects.toThrow(
        "Can only resend pending invitations"
      );
    });

    it("should throw unauthorized error if user cannot resend", async () => {
      const mockInvitation = {
        organizationId: "org-123",
        status: "pending",
        email: "test@example.com",
      };
      const mockMembership = { role: "member" };

      mockPrisma.invitation.findFirst.mockResolvedValueOnce(mockInvitation);
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(mockMembership);

      await expect(invitationService.resendInvitation(invitationId, userId)).rejects.toThrow(
        "Not authorized to resend invitations"
      );
    });
  });
});
 