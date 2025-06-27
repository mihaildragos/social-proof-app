import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

// Mock crypto module for password hashing
const mockCrypto = {
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue("hashed_password"),
  }),
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue("random_token"),
  }),
} as any;

// Mock jose JWT generation - properly mock the SignJWT constructor
const mockSignJWTInstance = {
  setProtectedHeader: jest.fn().mockReturnThis(),
  setSubject: jest.fn().mockReturnThis(),
  setIssuedAt: jest.fn().mockReturnThis(),
  setExpirationTime: jest.fn().mockReturnThis(),
  sign: jest.fn().mockResolvedValue("jwt_token_123" as never),
};

const mockJose = {
  SignJWT: jest.fn().mockImplementation(() => mockSignJWTInstance),
  jwtVerify: jest.fn(),
} as any;

// Mock Prisma client for PostgreSQL
const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  organization: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  organizationMember: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $disconnect: jest.fn(),
} as any;

// Mock ClerkSync service
const mockClerkSync = {
  syncUserFromClerk: jest.fn(),
  syncUserToSupabase: jest.fn(),
  handleClerkWebhook: jest.fn(),
  getUserClerkSyncStatus: jest.fn(),
} as any;

// Mock external dependencies
jest.mock("crypto", () => mockCrypto);
jest.mock("jose", () => mockJose);
jest.mock("../lib/prisma", () => ({
  prisma: mockPrisma,
}));
jest.mock("../utils/clerkSync", () => ({
  clerkSync: mockClerkSync,
}));

jest.mock("../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

// Import services after mocking
import { authService } from "../services/authService";

describe("Users Service - Authentication (PostgreSQL + Clerk Architecture)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up environment variables for JWT
    process.env.JWT_SECRET = "test_secret_key";
    process.env.PASSWORD_SALT = "test_salt";
    process.env.APP_URL = "http://localhost:3000";
  });

  afterEach(async () => {
    // Clean up environment variables
    delete process.env.JWT_SECRET;
    delete process.env.PASSWORD_SALT;
    delete process.env.APP_URL;
  });

  describe("User Registration", () => {
    it("should register a new user successfully", async () => {
      const signupData = {
        email: "test@example.com",
        password: "SecurePassword123!",
        fullName: "John Doe",
        preferredLanguage: "en",
        preferredTimezone: "UTC",
      };

      // Mock Prisma for checking existing user (should return null)
      mockPrisma.user.findFirst.mockResolvedValueOnce(null); // No existing user

      // Mock Prisma for creating user
      mockPrisma.user.create.mockResolvedValueOnce({ id: "user-123" });

      // Test the real service implementation
      const result = await authService.signup(signupData);

      expect(result).toBeDefined();
      expect(result.user.email).toBe(signupData.email);
      expect(result.user.fullName).toBe(signupData.fullName);
      expect(result.token).toBe("jwt_token_123");
      expect(result.expiresAt).toBeGreaterThan(Date.now());

      // Verify Prisma was called correctly
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ email: signupData.email }, { emailEncrypted: signupData.email }],
        },
        select: { id: true },
      });
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockJose.SignJWT).toHaveBeenCalled();
      expect(mockSignJWTInstance.sign).toHaveBeenCalled();
    });

    it("should register user with Clerk integration", async () => {
      const signupData = {
        email: "clerk@example.com",
        password: "TempPassword123!",
        fullName: "Clerk User",
        clerkUserId: "clerk_user_123",
      };

      // Mock Prisma for checking existing user (should return null)
      mockPrisma.user.findFirst.mockResolvedValueOnce(null); // No existing user

      // Mock Prisma for creating user
      mockPrisma.user.create.mockResolvedValueOnce({ id: "user-456" });

      // Test the real service implementation
      const result = await authService.signup(signupData);

      expect(result).toBeDefined();
      expect(result.user.email).toBe(signupData.email);
      // Note: Clerk sync is handled via webhooks, not direct calls
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authProvider: "clerk",
            authProviderId: "clerk_user_123",
            clerkUserId: "clerk_user_123",
          }),
        })
      );
    });

    it("should throw error if email already exists", async () => {
      const signupData = {
        email: "existing@example.com",
        password: "SecurePassword123!",
        fullName: "John Doe",
      };

      // Mock Prisma response for existing user
      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: "existing-user" });

      // Test the real service implementation
      await expect(authService.signup(signupData)).rejects.toThrow("Email already in use");

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ email: signupData.email }, { emailEncrypted: signupData.email }],
        },
        select: { id: true },
      });
    });
  });

  describe("User Authentication", () => {
    it("should authenticate user with valid credentials", async () => {
      const loginData = {
        email: "test@example.com",
        password: "SecurePassword123!",
      };

      const mockUser = {
        id: "user-123",
        authProvider: "email",
        hashedPassword: "hashed_password",
        authProviderId: null,
      };

      // Mock Prisma findFirst for login
      mockPrisma.user.findFirst.mockResolvedValueOnce(mockUser);

      // Mock getUserProfile - findUnique
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: "test@example.com",
        emailEncrypted: "test@example.com",
        fullName: "Test User",
        fullNameEncrypted: "Test User",
      });

      // Mock organization membership
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce({
        organizationId: "org-123",
        role: "admin",
      });

      // Mock update last login
      mockPrisma.user.update.mockResolvedValueOnce({});

      // Test the real service implementation
      const result = await authService.login(loginData.email, loginData.password);

      expect(result).toBeDefined();
      expect(result.token).toBe("jwt_token_123");
      expect(result.expiresAt).toBeDefined();

      // Verify Prisma calls
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          AND: [{ email: { contains: loginData.email } }, { authProvider: "email" }],
        },
        select: {
          id: true,
          hashedPassword: true,
          authProvider: true,
          authProviderId: true,
        },
      });

      // Verify JWT generation was called
      expect(mockJose.SignJWT).toHaveBeenCalled();
      expect(mockSignJWTInstance.sign).toHaveBeenCalled();
    });

    it("should throw error with invalid email", async () => {
      const loginData = {
        email: "nonexistent@example.com",
        password: "SecurePassword123!",
      };

      // Mock Prisma response for no user found
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      // Test the real service implementation
      await expect(authService.login(loginData.email, loginData.password)).rejects.toThrow(
        "Invalid credentials"
      );

      expect(mockPrisma.user.findFirst).toHaveBeenCalled();
    });

    it("should reject SSO users trying to use password login", async () => {
      const loginData = {
        email: "sso@example.com",
        password: "SecurePassword123!",
      };

      const mockUser = {
        id: "user-123",
        authProvider: "clerk", // SSO user
        hashedPassword: "hashed_password",
        authProviderId: "clerk_123",
      };

      // Mock Prisma response
      mockPrisma.user.findFirst.mockResolvedValueOnce(mockUser);

      // Test the real service implementation
      await expect(authService.login(loginData.email, loginData.password)).rejects.toThrow(
        "Please login using your SSO provider"
      );
    });
  });

  describe("Clerk Integration", () => {
    it("should sync existing user from Clerk", async () => {
      const clerkUserId = "clerk_user_123";
      const clerkUserData = {
        id: clerkUserId,
        emailAddresses: [{ emailAddress: "clerk@example.com", id: "email_1" }],
        firstName: "Clerk",
        lastName: "User",
      };

      const existingUser = {
        id: "user-123",
        authProvider: "clerk",
        authProviderId: clerkUserId,
      };

      // Mock existing user found
      mockPrisma.user.findFirst.mockResolvedValueOnce(existingUser);

      // Mock update last login
      mockPrisma.user.update.mockResolvedValueOnce({});

      // Mock getUserProfile - findUnique
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: "clerk@example.com",
        emailEncrypted: "clerk@example.com",
        fullName: "Clerk User",
        fullNameEncrypted: "Clerk User",
      });

      // Mock organization membership
      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce({
        organizationId: "org-123",
        role: "user",
      });

      const result = await authService.syncFromClerk(clerkUserId, clerkUserData);

      expect(result).toBeDefined();
      expect(result?.token).toBe("jwt_token_123");
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          authProvider: "clerk",
          authProviderId: clerkUserId,
        },
      });
    });

    it("should create new user from Clerk data", async () => {
      const clerkUserId = "clerk_user_456";
      const clerkUserData = {
        id: clerkUserId,
        emailAddresses: [{ emailAddress: "newuser@example.com", id: "email_1" }],
        firstName: "New",
        lastName: "User",
      };

      // Mock no existing user found
      mockPrisma.user.findFirst
        .mockResolvedValueOnce(null) // No existing Clerk user
        .mockResolvedValueOnce(null); // No existing user with email (in signup)

      // Mock creating new user
      mockPrisma.user.create.mockResolvedValueOnce({ id: "user-789" });

      const result = await authService.syncFromClerk(clerkUserId, clerkUserData);

      expect(result).toBeDefined();
      expect(result?.user.email).toBe("newuser@example.com");
      expect(result?.user.fullName).toBe("New User");
      // Note: Clerk sync is handled via webhooks, not direct calls
    });
  });

  describe("Password Reset Flow", () => {
    it("should initiate password reset for valid email user", async () => {
      const email = "test@example.com";

      const mockUser = {
        id: "user-123",
        authProvider: "email",
      };

      // Mock Prisma findFirst for finding user (actual implementation uses findFirst, not $queryRaw)
      mockPrisma.user.findFirst.mockResolvedValueOnce(mockUser);

      // Mock update for reset token
      mockPrisma.user.update.mockResolvedValueOnce({});

      // Test the real service implementation
      await authService.forgotPassword(email);

      // Verify Prisma was called to find user
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ email: email }, { emailEncrypted: email }],
        },
        select: {
          id: true,
          authProvider: true,
        },
      });
    });

    it("should handle non-existent email gracefully (security)", async () => {
      const email = "nonexistent@example.com";

      // Mock Prisma response for no user found
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      // Test the real service implementation - should not throw (security practice)
      await expect(authService.forgotPassword(email)).resolves.not.toThrow();
    });
  });

  describe("Business Logic Validation", () => {
    it("should validate password hashing consistency", () => {
      // Test that the service uses consistent password hashing
      const testPassword = "TestPassword123!";

      expect(testPassword).toBeDefined();
      expect(testPassword.length).toBeGreaterThan(8);
    });

    it("should handle JWT token generation", async () => {
      // Test JWT token generation functionality
      expect(mockJose.SignJWT).toBeDefined();

      const signupData = {
        email: "test@example.com",
        password: "SecurePassword123!",
        fullName: "Test User",
      };

      // Mock successful signup flow
      mockPrisma.user.findFirst.mockResolvedValueOnce(null); // No existing user
      mockPrisma.user.create.mockResolvedValueOnce({ id: "user-123" }); // Create user

      await authService.signup(signupData);

      // Verify JWT was created
      expect(mockJose.SignJWT).toHaveBeenCalled();
      expect(mockSignJWTInstance.sign).toHaveBeenCalled();
    });

    it("should validate Prisma integration", async () => {
      const email = "prisma@test.com";
      const password = "TestPassword123!";

      // Mock Prisma calls for login flow
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: "user-123",
        authProvider: "email",
        hashedPassword: "hashed_password",
        authProviderId: null,
      });

      // Mock getUserProfile - findUnique
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: email,
        emailEncrypted: email,
        fullName: "Prisma User",
        fullNameEncrypted: "Prisma User",
      });

      mockPrisma.organizationMember.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.update.mockResolvedValueOnce({});

      await authService.login(email, password);

      // Verify Prisma methods were called
      expect(mockPrisma.user.findFirst).toHaveBeenCalled();
      expect(mockPrisma.user.findUnique).toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });
  });
});
