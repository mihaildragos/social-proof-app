module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/__tests__/**", "!src/index.ts"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,
  transform: {
    "^.+\\.ts$": ["ts-jest", {
      tsconfig: {
        strict: false,
        noImplicitAny: false,
        noImplicitReturns: false,
        strictNullChecks: false,
        strictFunctionTypes: false,
        types: ["node", "jest"],
      },
    }],
  },
};
