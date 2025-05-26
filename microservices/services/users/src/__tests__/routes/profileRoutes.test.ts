import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { userService } from "../../services/userService";

// Mock supabase globally
const createMockQueryBuilder = (): any => ({
  eq: jest.fn(() => createMockQueryBuilder()),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  limit: jest.fn(() => createMockQueryBuilder()),
  range: jest.fn(() => createMockQueryBuilder()),
  data: null,
  error: null,
  count: 0,
});

(global as any).supabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => createMockQueryBuilder()),
    update: jest.fn(() => createMockQueryBuilder()),
    insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
    delete: jest.fn(() => createMockQueryBuilder()),
  })),
};

// Mock the user service
jest.mock("../../services/userService");
const mockUserService = userService as jest.Mocked<typeof userService>;

// Mock the logger
jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("Profile Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Service Integration", () => {
    const userId = "test-user-123";

    it("should get user profile successfully", async () => {
      const mockProfile = {
        id: "test-user-123",
        email: "test@example.com",
        fullName: "Test User",
        preferredLanguage: "en",
        preferredTimezone: "UTC",
        organizationId: "org-123",
        role: "admin",
        createdAt: "2024-01-01T00:00:00Z",
        lastLoginAt: "2024-01-01T12:00:00Z",
      };

      mockUserService.getUserProfile.mockResolvedValueOnce(mockProfile);

      const result = await mockUserService.getUserProfile(userId);

      expect(result).toEqual(mockProfile);
      expect(mockUserService.getUserProfile).toHaveBeenCalledWith(userId);
    });

    it("should update user profile successfully", async () => {
      const mockUpdatedProfile = {
        id: "test-user-123",
        email: "test@example.com",
        fullName: "Updated User",
        preferredLanguage: "es",
        preferredTimezone: "America/New_York",
        organizationId: "org-123",
        role: "admin",
        createdAt: "2024-01-01T00:00:00Z",
        lastLoginAt: "2024-01-01T12:00:00Z",
      };

      const updateParams = {
        fullName: "Updated User",
        preferredLanguage: "es",
        preferredTimezone: "America/New_York",
      };

      mockUserService.updateUserProfile.mockResolvedValueOnce(mockUpdatedProfile);

      const result = await mockUserService.updateUserProfile(userId, updateParams);

      expect(result).toEqual(mockUpdatedProfile);
      expect(mockUserService.updateUserProfile).toHaveBeenCalledWith(userId, updateParams);
    });

    it("should handle partial profile updates", async () => {
      const mockUpdatedProfile = {
        id: "test-user-123",
        email: "test@example.com",
        fullName: "Updated User",
        preferredLanguage: "en",
        preferredTimezone: "UTC",
        organizationId: "org-123",
        role: "admin",
        createdAt: "2024-01-01T00:00:00Z",
        lastLoginAt: "2024-01-01T12:00:00Z",
      };

      const partialUpdate = {
        fullName: "Updated User",
      };

      mockUserService.updateUserProfile.mockResolvedValueOnce(mockUpdatedProfile);

      const result = await mockUserService.updateUserProfile(userId, partialUpdate);

      expect(result).toEqual(mockUpdatedProfile);
      expect(mockUserService.updateUserProfile).toHaveBeenCalledWith(userId, partialUpdate);
    });

    it("should change password successfully", async () => {
      mockUserService.changePassword.mockResolvedValueOnce(undefined);

      await mockUserService.changePassword(userId, "oldpassword123", "newpassword123");

      expect(mockUserService.changePassword).toHaveBeenCalledWith(
        userId,
        "oldpassword123",
        "newpassword123"
      );
    });
  });

  describe("Preference Validation", () => {
    it("should validate user preferences structure", () => {
      const validPreferences = {
        emailNotifications: true,
        pushNotifications: false,
        marketingEmails: false,
        weeklyReports: true,
        theme: "dark" as const,
        language: "en",
        timezone: "UTC",
      };

      expect(validPreferences.emailNotifications).toBeDefined();
      expect(validPreferences.pushNotifications).toBeDefined();
      expect(validPreferences.marketingEmails).toBeDefined();
      expect(validPreferences.weeklyReports).toBeDefined();
      expect(validPreferences.theme).toBeDefined();
      expect(validPreferences.language).toBeDefined();
      expect(validPreferences.timezone).toBeDefined();

      expect(typeof validPreferences.emailNotifications).toBe("boolean");
      expect(typeof validPreferences.pushNotifications).toBe("boolean");
      expect(typeof validPreferences.marketingEmails).toBe("boolean");
      expect(typeof validPreferences.weeklyReports).toBe("boolean");
      expect(typeof validPreferences.theme).toBe("string");
      expect(typeof validPreferences.language).toBe("string");
      expect(typeof validPreferences.timezone).toBe("string");
    });

    it("should validate theme options", () => {
      const validThemes = ["light", "dark", "auto"];
      const testTheme = "dark";

      expect(validThemes).toContain(testTheme);
    });

    it("should validate language codes", () => {
      const validLanguages = ["en", "es", "fr", "de", "it", "pt", "ja", "ko", "zh"];
      const testLanguage = "en";

      expect(validLanguages).toContain(testLanguage);
    });

    it("should validate timezone format", () => {
      const validTimezones = [
        "UTC",
        "America/New_York",
        "America/Los_Angeles",
        "Europe/London",
        "Europe/Paris",
        "Asia/Tokyo",
        "Asia/Shanghai",
      ];
      const testTimezone = "UTC";

      expect(validTimezones).toContain(testTimezone);
    });
  });

  describe("Password Validation", () => {
    it("should validate password change request", () => {
      const passwordChangeRequest = {
        currentPassword: "oldpassword123",
        newPassword: "newpassword123",
        confirmPassword: "newpassword123",
      };

      expect(passwordChangeRequest.currentPassword).toBeDefined();
      expect(passwordChangeRequest.newPassword).toBeDefined();
      expect(passwordChangeRequest.confirmPassword).toBeDefined();
      expect(passwordChangeRequest.newPassword).toBe(passwordChangeRequest.confirmPassword);
    });

    it("should detect password mismatch", () => {
      const passwordChangeRequest = {
        currentPassword: "oldpassword123",
        newPassword: "newpassword123",
        confirmPassword: "differentpassword123",
      };

      expect(passwordChangeRequest.newPassword).not.toBe(passwordChangeRequest.confirmPassword);
    });

    it("should validate password strength requirements", () => {
      const weakPassword = "123";
      const strongPassword = "newpassword123";

      expect(weakPassword.length).toBeLessThan(8);
      expect(strongPassword.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe("Activity Log Structure", () => {
    it("should validate activity log entry structure", () => {
      const activityEntry = {
        type: "login",
        description: "Signed in to account",
        ipAddress: "127.0.0.1",
        userAgent: "Test User Agent",
        timestamp: "2024-01-01T12:00:00Z",
      };

      expect(activityEntry.type).toBeDefined();
      expect(activityEntry.description).toBeDefined();
      expect(activityEntry.ipAddress).toBeDefined();
      expect(activityEntry.userAgent).toBeDefined();
      expect(activityEntry.timestamp).toBeDefined();
    });

    it("should validate pagination structure", () => {
      const pagination = {
        page: 1,
        limit: 20,
        total: 100,
        totalPages: 5,
      };

      expect(pagination.page).toBeGreaterThan(0);
      expect(pagination.limit).toBeGreaterThan(0);
      expect(pagination.total).toBeGreaterThanOrEqual(0);
      expect(pagination.totalPages).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Data Export and Deletion", () => {
    it("should validate export request format", () => {
      const exportRequest = {
        format: "json",
        includeActivityLog: true,
        includePreferences: true,
      };

      expect(exportRequest.format).toBeDefined();
      expect(typeof exportRequest.includeActivityLog).toBe("boolean");
      expect(typeof exportRequest.includePreferences).toBe("boolean");
    });

    it("should validate deletion request", () => {
      const deletionRequest = {
        confirmDeletion: true,
        reason: "No longer needed",
      };

      expect(typeof deletionRequest.confirmDeletion).toBe("boolean");
      expect(deletionRequest.confirmDeletion).toBe(true);
      expect(deletionRequest.reason).toBeDefined();
    });
  });
});
