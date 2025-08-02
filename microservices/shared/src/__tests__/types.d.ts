// Type declarations for Jest test environment

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidJWT(): R;
      toBeValidAPIKey(): R;
      toBeValidHash(): R;
    }
  }

  var testUtils: {
    createTestDate: (offsetMs?: number) => Date;
    createTestOrgId: () => string;
    createTestUserId: () => string;
    wait: (ms: number) => Promise<void>;
  };
}

export {};
