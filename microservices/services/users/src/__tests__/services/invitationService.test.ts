import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { invitationService } from "../../services/invitationService";
import { db } from "../../utils/db";

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

// Mock crypto
jest.mock("crypto", () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => "mock-token-123"),
  })),
  createHash: jest.fn(() => ({
    update: jest.fn(() => ({
      digest: jest.fn(() => "mocked-hash"),
    })),
  })),
}));

describe("InvitationService", () => {
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
        organization_id: "org-123",
        role: "admin",
        token: "mock-token-123",
        status: "pending",
        invited_by: "user-123",
        created_at: "2024-01-01T00:00:00Z",
        expires_at: "2024-01-08T00:00:00Z",
      };
      const mockOrganization = {
        id: "org-123",
        name: "Test Organization",
        slug: "test-org",
      };

      mockDb.getOne
        .mockResolvedValueOnce(mockMembership) // User permission check
        .mockResolvedValueOnce(null) // No existing user
        .mockResolvedValueOnce(null) // No existing invitation
        .mockResolvedValueOnce(mockInvitation) // Created invitation
        .mockResolvedValueOnce(mockOrganization); // Organization details

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
      mockDb.getOne.mockResolvedValueOnce({ role: "member" });

      await expect(invitationService.createInvitation(mockParams)).rejects.toThrow(
        "Not authorized to send invitations"
      );
    });

    it("should throw error if user is already a member", async () => {
      const mockMembership = { role: "owner" };
      const mockExistingUser = { id: "existing-user" };

      mockDb.getOne.mockResolvedValueOnce(mockMembership).mockResolvedValueOnce(mockExistingUser);

      await expect(invitationService.createInvitation(mockParams)).rejects.toThrow(
        "User is already a member of this organization"
      );
    });

    it("should throw error if invitation already exists", async () => {
      const mockMembership = { role: "owner" };
      const mockExistingInvitation = { id: "existing-invitation" };

      mockDb.getOne
        .mockResolvedValueOnce(mockMembership)
        .mockResolvedValueOnce(null) // No existing user
        .mockResolvedValueOnce(mockExistingInvitation);

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
          organization_id: "org-123",
          role: "admin",
          token: "token-1",
          status: "pending",
          invited_by: "user-123",
          created_at: "2024-01-01T00:00:00Z",
          expires_at: "2024-01-08T00:00:00Z",
          org_id: "org-123",
          org_name: "Test Organization",
          org_slug: "test-org",
        },
        {
          id: "invitation-2",
          email: "user2@example.com",
          organization_id: "org-123",
          role: "member",
          token: "token-2",
          status: "accepted",
          invited_by: "user-123",
          created_at: "2024-01-02T00:00:00Z",
          expires_at: "2024-01-09T00:00:00Z",
          org_id: "org-123",
          org_name: "Test Organization",
          org_slug: "test-org",
        },
      ];

      mockDb.getOne.mockResolvedValueOnce(mockMembership);
      mockDb.getMany.mockResolvedValueOnce(mockInvitations);

      const result = await invitationService.listOrganizationInvitations(organizationId, userId);

      expect(result).toHaveLength(2);
      expect(result[0].email).toBe("user1@example.com");
      expect(result[0].status).toBe("pending");
      expect(result[1].email).toBe("user2@example.com");
      expect(result[1].status).toBe("accepted");
    });

    it("should throw unauthorized error if user is not a member", async () => {
      mockDb.getOne.mockResolvedValueOnce(null);

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
        organization_id: "org-123",
        role: "admin",
        token: "valid-token-123",
        status: "pending",
        invited_by: "user-123",
        created_at: "2024-01-01T00:00:00Z",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Future date
        org_id: "org-123",
        org_name: "Test Organization",
        org_slug: "test-org",
      };

      mockDb.getOne.mockResolvedValueOnce(mockInvitation);

      const result = await invitationService.verifyInvitationToken(token);

      expect(result.token).toBe("valid-token-123");
      expect(result.status).toBe("pending");
      expect(result.organization?.name).toBe("Test Organization");
    });

    it("should throw error if token is invalid", async () => {
      mockDb.getOne.mockResolvedValueOnce(null);

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

      mockDb.getOne.mockResolvedValueOnce(mockInvitation);

      await expect(invitationService.verifyInvitationToken(token)).rejects.toThrow(
        "Invitation has already been used or cancelled"
      );
    });

    it("should throw error if invitation is expired", async () => {
      const mockInvitation = {
        id: "invitation-123",
        status: "pending",
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Past date
      };

      mockDb.getOne.mockResolvedValueOnce(mockInvitation);

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

      mockDb.execute
        .mockResolvedValueOnce(1) // Add to organization
        .mockResolvedValueOnce(1); // Mark invitation as accepted

      const result = await invitationService.acceptInvitation(mockParams);

      expect(result).toEqual({
        message: "Invitation accepted successfully",
        organizationId: "org-123",
        role: "admin",
        userId: "existing-user-123",
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO organization_members"),
        ["existing-user-123", "org-123", "admin"]
      );
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

      mockDb.getOne
        .mockResolvedValueOnce(null) // No existing user
        .mockResolvedValueOnce(mockNewUser); // Created user

      mockDb.execute
        .mockResolvedValueOnce(1) // Add to organization
        .mockResolvedValueOnce(1); // Mark invitation as accepted

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

      mockDb.getOne.mockResolvedValueOnce(mockExistingUser);

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
        organization_id: "org-123",
        status: "pending",
      };
      const mockMembership = { role: "admin" };

      mockDb.getOne.mockResolvedValueOnce(mockInvitation).mockResolvedValueOnce(mockMembership);
      mockDb.execute.mockResolvedValueOnce(1);

      await invitationService.cancelInvitation(invitationId, userId);

      expect(mockDb.execute).toHaveBeenCalledWith(
        "UPDATE invitations SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1",
        [invitationId]
      );
    });

    it("should throw error if invitation not found", async () => {
      mockDb.getOne.mockResolvedValueOnce(null);

      await expect(invitationService.cancelInvitation(invitationId, userId)).rejects.toThrow(
        "Invitation not found"
      );
    });

    it("should throw error if invitation is not pending", async () => {
      const mockInvitation = {
        organization_id: "org-123",
        status: "accepted",
      };

      mockDb.getOne.mockResolvedValueOnce(mockInvitation);

      await expect(invitationService.cancelInvitation(invitationId, userId)).rejects.toThrow(
        "Can only cancel pending invitations"
      );
    });

    it("should throw unauthorized error if user cannot cancel", async () => {
      const mockInvitation = {
        organization_id: "org-123",
        status: "pending",
      };
      const mockMembership = { role: "member" };

      mockDb.getOne.mockResolvedValueOnce(mockInvitation).mockResolvedValueOnce(mockMembership);

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
        organization_id: "org-123",
        status: "pending",
        email: "test@example.com",
      };
      const mockMembership = { role: "admin" };

      mockDb.getOne.mockResolvedValueOnce(mockInvitation).mockResolvedValueOnce(mockMembership);
      mockDb.execute.mockResolvedValueOnce(1);

      await invitationService.resendInvitation(invitationId, userId);

      expect(mockDb.execute).toHaveBeenCalledWith(
        "UPDATE invitations SET expires_at = $1, updated_at = NOW() WHERE id = $2",
        [expect.any(String), invitationId]
      );
    });

    it("should throw error if invitation not found", async () => {
      mockDb.getOne.mockResolvedValueOnce(null);

      await expect(invitationService.resendInvitation(invitationId, userId)).rejects.toThrow(
        "Invitation not found"
      );
    });

    it("should throw error if invitation is not pending", async () => {
      const mockInvitation = {
        organization_id: "org-123",
        status: "accepted",
        email: "test@example.com",
      };

      mockDb.getOne.mockResolvedValueOnce(mockInvitation);

      await expect(invitationService.resendInvitation(invitationId, userId)).rejects.toThrow(
        "Can only resend pending invitations"
      );
    });

    it("should throw unauthorized error if user cannot resend", async () => {
      const mockInvitation = {
        organization_id: "org-123",
        status: "pending",
        email: "test@example.com",
      };
      const mockMembership = { role: "member" };

      mockDb.getOne.mockResolvedValueOnce(mockInvitation).mockResolvedValueOnce(mockMembership);

      await expect(invitationService.resendInvitation(invitationId, userId)).rejects.toThrow(
        "Not authorized to resend invitations"
      );
    });
  });
});
 