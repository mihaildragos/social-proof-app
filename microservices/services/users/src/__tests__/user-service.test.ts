import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

// Mock user data
const mockUser = {
  id: "user-123",
  email: "test@example.com",
  firstName: "John",
  lastName: "Doe",
  role: "ADMIN" as const,
  organizationId: "org-123",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  isActive: true,
  lastLoginAt: null,
};

const mockOrganization = {
  id: "org-123",
  name: "Test Corp",
  slug: "test-corp",
  plan: "STANDARD" as const,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

// Mock database operations
const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  organization: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

// Mock password hashing
const mockBcrypt = {
  hash: jest.fn(),
  compare: jest.fn(),
};

// Mock email service
const mockEmailService = {
  sendWelcomeEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
};

describe("UserService", () => {
  // Mock UserService class
  class UserService {
    constructor(
      private prisma = mockPrisma,
      private bcrypt = mockBcrypt,
      private emailService = mockEmailService
    ) {}

    async createUser(userData: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      organizationName?: string;
    }) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email)) {
        throw new Error("Invalid email format");
      }

      // Validate password strength
      if (userData.password.length < 8) {
        throw new Error("Password must be at least 8 characters long");
      }

      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existingUser) {
        throw new Error("Email already exists");
      }

      // Hash password
      const hashedPassword = await this.bcrypt.hash(userData.password, 12);

      // Create organization if provided
      let organizationId = null;
      if (userData.organizationName) {
        const organization = await this.prisma.organization.create({
          data: {
            name: userData.organizationName,
            slug: userData.organizationName.toLowerCase().replace(/\s+/g, "-"),
          },
        });
        organizationId = organization.id;
      }

      // Create user
      const user = await this.prisma.user.create({
        data: {
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          organizationId,
          role: "ADMIN",
        },
      });

      // Send welcome email
      await this.emailService.sendWelcomeEmail(user.email, user.firstName);

      return user;
    }

    async getUserById(id: string) {
      if (!id) {
        throw new Error("User ID is required");
      }

      const user = await this.prisma.user.findUnique({
        where: { id },
        include: {
          organization: true,
        },
      });

      if (!user) {
        throw new Error("User not found");
      }

      return user;
    }

    async getUserByEmail(email: string) {
      if (!email) {
        throw new Error("Email is required");
      }

      const user = await this.prisma.user.findUnique({
        where: { email },
        include: {
          organization: true,
        },
      });

      return user;
    }

    async updateUser(
      id: string,
      updateData: {
        firstName?: string;
        lastName?: string;
        email?: string;
      }
    ) {
      if (!id) {
        throw new Error("User ID is required");
      }

      // Validate email if provided
      if (updateData.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(updateData.email)) {
          throw new Error("Invalid email format");
        }

        // Check if email is already taken
        const existingUser = await this.prisma.user.findUnique({
          where: { email: updateData.email },
        });

        if (existingUser && existingUser.id !== id) {
          throw new Error("Email already exists");
        }
      }

      const user = await this.prisma.user.update({
        where: { id },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
      });

      return user;
    }

    async deleteUser(id: string) {
      if (!id) {
        throw new Error("User ID is required");
      }

      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        throw new Error("User not found");
      }

      await this.prisma.user.delete({
        where: { id },
      });

      return true;
    }

    async getUsersByOrganization(organizationId: string, page = 1, limit = 10) {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }

      const offset = (page - 1) * limit;

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where: { organizationId },
          skip: offset,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.user.count({
          where: { organizationId },
        }),
      ]);

      return {
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    async updateLastLogin(id: string) {
      if (!id) {
        throw new Error("User ID is required");
      }

      const user = await this.prisma.user.update({
        where: { id },
        data: {
          lastLoginAt: new Date(),
        },
      });

      return user;
    }
  }

  let userService: UserService;

  beforeEach(() => {
    jest.clearAllMocks();
    userService = new UserService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("createUser", () => {
    const validUserData = {
      email: "test@example.com",
      password: "SecurePassword123!",
      firstName: "John",
      lastName: "Doe",
      organizationName: "Test Corp",
    };

    it("should create a new user successfully", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.organization.create.mockResolvedValue(mockOrganization);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockBcrypt.hash.mockResolvedValue("hashed-password");
      mockEmailService.sendWelcomeEmail.mockResolvedValue(true);

      const result = await userService.createUser(validUserData);

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: validUserData.email },
      });
      expect(mockBcrypt.hash).toHaveBeenCalledWith(validUserData.password, 12);
      expect(mockPrisma.organization.create).toHaveBeenCalledWith({
        data: {
          name: validUserData.organizationName,
          slug: "test-corp",
        },
      });
      expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith(
        validUserData.email,
        validUserData.firstName
      );
    });

    it("should throw error for invalid email format", async () => {
      const invalidData = {
        ...validUserData,
        email: "invalid-email",
      };

      await expect(userService.createUser(invalidData)).rejects.toThrow("Invalid email format");
    });

    it("should throw error for weak password", async () => {
      const invalidData = {
        ...validUserData,
        password: "123",
      };

      await expect(userService.createUser(invalidData)).rejects.toThrow(
        "Password must be at least 8 characters long"
      );
    });

    it("should throw error for existing email", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(userService.createUser(validUserData)).rejects.toThrow("Email already exists");
    });

    it("should create user without organization", async () => {
      const userDataWithoutOrg = {
        email: "test@example.com",
        password: "SecurePassword123!",
        firstName: "John",
        lastName: "Doe",
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...mockUser, organizationId: null });
      mockBcrypt.hash.mockResolvedValue("hashed-password");
      mockEmailService.sendWelcomeEmail.mockResolvedValue(true);

      const result = await userService.createUser(userDataWithoutOrg);

      expect(result.organizationId).toBeNull();
      expect(mockPrisma.organization.create).not.toHaveBeenCalled();
    });
  });

  describe("getUserById", () => {
    it("should return user by ID successfully", async () => {
      const userWithOrg = { ...mockUser, organization: mockOrganization };
      mockPrisma.user.findUnique.mockResolvedValue(userWithOrg);

      const result = await userService.getUserById("user-123");

      expect(result).toEqual(userWithOrg);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-123" },
        include: { organization: true },
      });
    });

    it("should throw error for missing user ID", async () => {
      await expect(userService.getUserById("")).rejects.toThrow("User ID is required");
    });

    it("should throw error for non-existent user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(userService.getUserById("non-existent")).rejects.toThrow("User not found");
    });
  });

  describe("getUserByEmail", () => {
    it("should return user by email successfully", async () => {
      const userWithOrg = { ...mockUser, organization: mockOrganization };
      mockPrisma.user.findUnique.mockResolvedValue(userWithOrg);

      const result = await userService.getUserByEmail("test@example.com");

      expect(result).toEqual(userWithOrg);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        include: { organization: true },
      });
    });

    it("should throw error for missing email", async () => {
      await expect(userService.getUserByEmail("")).rejects.toThrow("Email is required");
    });

    it("should return null for non-existent user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await userService.getUserByEmail("nonexistent@example.com");

      expect(result).toBeNull();
    });
  });

  describe("updateUser", () => {
    const updateData = {
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
    };

    it("should update user successfully", async () => {
      const updatedUser = { ...mockUser, ...updateData };
      mockPrisma.user.findUnique.mockResolvedValue(null); // No existing user with new email
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await userService.updateUser("user-123", updateData);

      expect(result).toEqual(updatedUser);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: {
          ...updateData,
          updatedAt: expect.any(Date),
        },
      });
    });

    it("should throw error for missing user ID", async () => {
      await expect(userService.updateUser("", updateData)).rejects.toThrow("User ID is required");
    });

    it("should throw error for invalid email format", async () => {
      const invalidData = { email: "invalid-email" };

      await expect(userService.updateUser("user-123", invalidData)).rejects.toThrow(
        "Invalid email format"
      );
    });

    it("should throw error for existing email", async () => {
      const existingUser = { ...mockUser, id: "other-user" };
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      await expect(
        userService.updateUser("user-123", { email: "existing@example.com" })
      ).rejects.toThrow("Email already exists");
    });

    it("should allow updating to same email", async () => {
      const updatedUser = { ...mockUser, firstName: "Jane" };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser); // Same user
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await userService.updateUser("user-123", {
        firstName: "Jane",
        email: mockUser.email,
      });

      expect(result).toEqual(updatedUser);
    });
  });

  describe("deleteUser", () => {
    it("should delete user successfully", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.delete.mockResolvedValue(mockUser);

      const result = await userService.deleteUser("user-123");

      expect(result).toBe(true);
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: "user-123" },
      });
    });

    it("should throw error for missing user ID", async () => {
      await expect(userService.deleteUser("")).rejects.toThrow("User ID is required");
    });

    it("should throw error for non-existent user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(userService.deleteUser("non-existent")).rejects.toThrow("User not found");
    });
  });

  describe("getUsersByOrganization", () => {
    const mockUsers = [mockUser, { ...mockUser, id: "user-456" }];

    it("should return paginated users successfully", async () => {
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.user.count.mockResolvedValue(15);

      const result = await userService.getUsersByOrganization("org-123", 1, 10);

      expect(result).toEqual({
        users: mockUsers,
        total: 15,
        page: 1,
        limit: 10,
        totalPages: 2,
      });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-123" },
        skip: 0,
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    });

    it("should throw error for missing organization ID", async () => {
      await expect(userService.getUsersByOrganization("")).rejects.toThrow(
        "Organization ID is required"
      );
    });

    it("should handle pagination correctly", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(25);

      const result = await userService.getUsersByOrganization("org-123", 3, 10);

      expect(result.page).toBe(3);
      expect(result.totalPages).toBe(3);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-123" },
        skip: 20,
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("updateLastLogin", () => {
    it("should update last login successfully", async () => {
      const updatedUser = { ...mockUser, lastLoginAt: new Date() };
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await userService.updateLastLogin("user-123");

      expect(result).toEqual(updatedUser);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: {
          lastLoginAt: expect.any(Date),
        },
      });
    });

    it("should throw error for missing user ID", async () => {
      await expect(userService.updateLastLogin("")).rejects.toThrow("User ID is required");
    });
  });
});
