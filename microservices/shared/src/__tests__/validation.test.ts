import { describe, it, expect } from "@jest/globals";

describe("Validation Utilities", () => {
  // Mock validation functions
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // Additional check for consecutive dots which are invalid
    if (email.includes("..")) {
      return false;
    }
    return emailRegex.test(email);
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const isValidUUID = (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  };

  const validateNotificationData = (data: any): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!data.type || typeof data.type !== "string") {
      errors.push("Type is required and must be a string");
    }

    if (!data.message || typeof data.message !== "string") {
      errors.push("Message is required and must be a string");
    }

    if (!data.siteId || typeof data.siteId !== "string") {
      errors.push("Site ID is required and must be a string");
    }

    if (data.metadata && typeof data.metadata !== "object") {
      errors.push("Metadata must be an object");
    }

    if (data.priority && !["low", "normal", "high", "urgent"].includes(data.priority)) {
      errors.push("Priority must be one of: low, normal, high, urgent");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  const validateUserData = (data: any): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!data.email || !isValidEmail(data.email)) {
      errors.push("Valid email is required");
    }

    if (
      !data.firstName ||
      typeof data.firstName !== "string" ||
      data.firstName.trim().length === 0
    ) {
      errors.push("First name is required");
    }

    if (!data.lastName || typeof data.lastName !== "string" || data.lastName.trim().length === 0) {
      errors.push("Last name is required");
    }

    if (data.role && !["ADMIN", "USER", "ANALYST", "DESIGNER"].includes(data.role)) {
      errors.push("Role must be one of: ADMIN, USER, ANALYST, DESIGNER");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  const validateSiteData = (data: any): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
      errors.push("Site name is required");
    }

    if (!data.domain || typeof data.domain !== "string") {
      errors.push("Domain is required");
    }

    if (data.domain && (!data.domain.includes(".") || !isValidUrl(`https://${data.domain}`))) {
      errors.push("Domain must be a valid domain name");
    }

    if (!data.organizationId || typeof data.organizationId !== "string") {
      errors.push("Organization ID is required");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  const sanitizeInput = (input: string): string => {
    return input
      .replace(/[<>]/g, "") // Remove potential HTML tags
      .replace(/['"]/g, "") // Remove quotes
      .trim();
  };

  const validateApiKey = (apiKey: string): boolean => {
    // API key should be 32 characters long and contain only alphanumeric characters
    const apiKeyRegex = /^[a-zA-Z0-9]{32}$/;
    return apiKeyRegex.test(apiKey);
  };

  describe("isValidEmail", () => {
    it("should validate correct email addresses", () => {
      expect(isValidEmail("test@example.com")).toBe(true);
      expect(isValidEmail("user.name@domain.co.uk")).toBe(true);
      expect(isValidEmail("user+tag@example.org")).toBe(true);
    });

    it("should reject invalid email addresses", () => {
      expect(isValidEmail("invalid-email")).toBe(false);
      expect(isValidEmail("test@")).toBe(false);
      expect(isValidEmail("@example.com")).toBe(false);
      expect(isValidEmail("test..test@example.com")).toBe(false);
      expect(isValidEmail("")).toBe(false);
    });
  });

  describe("isValidUrl", () => {
    it("should validate correct URLs", () => {
      expect(isValidUrl("https://example.com")).toBe(true);
      expect(isValidUrl("http://localhost:3000")).toBe(true);
      expect(isValidUrl("https://subdomain.example.com/path")).toBe(true);
    });

    it("should reject invalid URLs", () => {
      expect(isValidUrl("not-a-url")).toBe(false);
      expect(isValidUrl("ftp://example.com")).toBe(true); // FTP is valid URL
      expect(isValidUrl("")).toBe(false);
      expect(isValidUrl("http://")).toBe(false);
    });
  });

  describe("isValidUUID", () => {
    it("should validate correct UUIDs", () => {
      expect(isValidUUID("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
      expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    });

    it("should reject invalid UUIDs", () => {
      expect(isValidUUID("not-a-uuid")).toBe(false);
      expect(isValidUUID("123e4567-e89b-12d3-a456")).toBe(false);
      expect(isValidUUID("123e4567-e89b-12d3-a456-42661417400g")).toBe(false);
      expect(isValidUUID("")).toBe(false);
    });
  });

  describe("validateNotificationData", () => {
    const validNotificationData = {
      type: "purchase",
      message: "Someone just purchased a product",
      siteId: "site-123",
      metadata: { product: "Premium Plan" },
      priority: "normal",
    };

    it("should validate correct notification data", () => {
      const result = validateNotificationData(validNotificationData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject notification data without type", () => {
      const invalidData = { ...validNotificationData, type: "" };
      const result = validateNotificationData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Type is required and must be a string");
    });

    it("should reject notification data without message", () => {
      const invalidData = { ...validNotificationData, message: null };
      const result = validateNotificationData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Message is required and must be a string");
    });

    it("should reject notification data without site ID", () => {
      const invalidData = { ...validNotificationData, siteId: undefined };
      const result = validateNotificationData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Site ID is required and must be a string");
    });

    it("should reject notification data with invalid metadata", () => {
      const invalidData = { ...validNotificationData, metadata: "not-an-object" };
      const result = validateNotificationData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Metadata must be an object");
    });

    it("should reject notification data with invalid priority", () => {
      const invalidData = { ...validNotificationData, priority: "invalid" };
      const result = validateNotificationData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Priority must be one of: low, normal, high, urgent");
    });

    it("should allow optional fields to be undefined", () => {
      const minimalData = {
        type: "purchase",
        message: "Test message",
        siteId: "site-123",
      };
      const result = validateNotificationData(minimalData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("validateUserData", () => {
    const validUserData = {
      email: "test@example.com",
      firstName: "John",
      lastName: "Doe",
      role: "USER",
    };

    it("should validate correct user data", () => {
      const result = validateUserData(validUserData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject user data with invalid email", () => {
      const invalidData = { ...validUserData, email: "invalid-email" };
      const result = validateUserData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Valid email is required");
    });

    it("should reject user data without first name", () => {
      const invalidData = { ...validUserData, firstName: "" };
      const result = validateUserData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("First name is required");
    });

    it("should reject user data without last name", () => {
      const invalidData = { ...validUserData, lastName: "   " };
      const result = validateUserData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Last name is required");
    });

    it("should reject user data with invalid role", () => {
      const invalidData = { ...validUserData, role: "INVALID_ROLE" };
      const result = validateUserData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Role must be one of: ADMIN, USER, ANALYST, DESIGNER");
    });

    it("should allow optional role field", () => {
      const dataWithoutRole = {
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      };
      const result = validateUserData(dataWithoutRole);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("validateSiteData", () => {
    const validSiteData = {
      name: "My Website",
      domain: "example.com",
      organizationId: "org-123",
    };

    it("should validate correct site data", () => {
      const result = validateSiteData(validSiteData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject site data without name", () => {
      const invalidData = { ...validSiteData, name: "" };
      const result = validateSiteData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Site name is required");
    });

    it("should reject site data without domain", () => {
      const invalidData = { ...validSiteData, domain: null };
      const result = validateSiteData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Domain is required");
    });

    it("should reject site data with invalid domain", () => {
      const invalidData = { ...validSiteData, domain: "invalid-domain" };
      const result = validateSiteData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Domain must be a valid domain name");
    });

    it("should reject site data without organization ID", () => {
      const invalidData = { ...validSiteData, organizationId: undefined };
      const result = validateSiteData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Organization ID is required");
    });
  });

  describe("sanitizeInput", () => {
    it("should remove HTML tags", () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe("scriptalert(xss)/script");
      expect(sanitizeInput("Hello <b>world</b>")).toBe("Hello bworld/b");
    });

    it("should remove quotes", () => {
      expect(sanitizeInput('Hello "world"')).toBe("Hello world");
      expect(sanitizeInput("Hello 'world'")).toBe("Hello world");
    });

    it("should trim whitespace", () => {
      expect(sanitizeInput("  hello world  ")).toBe("hello world");
      expect(sanitizeInput("\n\ttest\n\t")).toBe("test");
    });

    it("should handle empty strings", () => {
      expect(sanitizeInput("")).toBe("");
      expect(sanitizeInput("   ")).toBe("");
    });

    it("should handle normal text", () => {
      expect(sanitizeInput("Hello world")).toBe("Hello world");
      expect(sanitizeInput("123 ABC xyz")).toBe("123 ABC xyz");
    });
  });

  describe("validateApiKey", () => {
    it("should validate correct API keys", () => {
      expect(validateApiKey("abcdef1234567890abcdef1234567890")).toBe(true);
      expect(validateApiKey("ABCDEF1234567890ABCDEF1234567890")).toBe(true);
      expect(validateApiKey("1234567890abcdefABCDEF1234567890")).toBe(true);
    });

    it("should reject invalid API keys", () => {
      expect(validateApiKey("short")).toBe(false);
      expect(validateApiKey("abcdef1234567890abcdef1234567890!")).toBe(false); // Contains special character
      expect(validateApiKey("abcdef1234567890abcdef123456789")).toBe(false); // Too short
      expect(validateApiKey("abcdef1234567890abcdef1234567890a")).toBe(false); // Too long
      expect(validateApiKey("")).toBe(false);
    });
  });

  describe("Complex validation scenarios", () => {
    it("should handle multiple validation errors", () => {
      const invalidNotificationData = {
        type: "",
        message: null,
        siteId: undefined,
        metadata: "not-an-object",
        priority: "invalid",
      };

      const result = validateNotificationData(invalidNotificationData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(5);
      expect(result.errors).toContain("Type is required and must be a string");
      expect(result.errors).toContain("Message is required and must be a string");
      expect(result.errors).toContain("Site ID is required and must be a string");
      expect(result.errors).toContain("Metadata must be an object");
      expect(result.errors).toContain("Priority must be one of: low, normal, high, urgent");
    });

    it("should handle edge cases in user validation", () => {
      const edgeCaseUserData = {
        email: "test@example.com",
        firstName: "   ",
        lastName: null,
        role: "ADMIN",
      };

      const result = validateUserData(edgeCaseUserData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("First name is required");
      expect(result.errors).toContain("Last name is required");
    });

    it("should validate nested object structures", () => {
      const complexNotificationData = {
        type: "purchase",
        message: "Complex notification",
        siteId: "site-123",
        metadata: {
          customer: {
            name: "John Doe",
            email: "john@example.com",
          },
          product: {
            id: "prod-123",
            name: "Premium Plan",
            price: 99.99,
          },
          transaction: {
            id: "txn-123",
            timestamp: new Date().toISOString(),
          },
        },
        priority: "high",
      };

      const result = validateNotificationData(complexNotificationData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
