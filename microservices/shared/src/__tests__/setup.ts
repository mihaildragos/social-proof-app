// Jest setup file for authentication tests

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-key-for-testing-only";
process.env.SERVICE_JWT_SECRET = "test-service-jwt-secret-key-for-testing-only";
process.env.JWT_ISSUER = "test-social-proof-app";
process.env.JWT_AUDIENCE = "test-social-proof-api";

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});

// Global test utilities
(global as any).testUtils = {
  // Helper to create test dates
  createTestDate: (offsetMs = 0) => new Date(Date.now() + offsetMs),

  // Helper to create test organization ID
  createTestOrgId: () => `test-org-${Math.random().toString(36).substr(2, 9)}`,

  // Helper to create test user ID
  createTestUserId: () => `test-user-${Math.random().toString(36).substr(2, 9)}`,

  // Helper to wait for async operations
  wait: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
};

// Extend Jest matchers for better assertions
expect.extend({
  toBeValidJWT(received: string) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    const pass = typeof received === "string" && jwtRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid JWT`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid JWT`,
        pass: false,
      };
    }
  },

  toBeValidAPIKey(received: string) {
    const apiKeyRegex = /^sp_[a-f0-9]{64}$/;
    const pass = typeof received === "string" && apiKeyRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid API key`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid API key`,
        pass: false,
      };
    }
  },

  toBeValidHash(received: string) {
    const hashRegex = /^[a-f0-9]{64}$/;
    const pass = typeof received === "string" && hashRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid SHA256 hash`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid SHA256 hash`,
        pass: false,
      };
    }
  },
});

// Types are loaded automatically via types.d.ts
