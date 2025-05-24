module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
  testMatch: ["**/__tests__/**/*.test.(ts|js)", "**/?(*.)+(spec|test).(ts|js)"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  coverageDirectory: "./coverage",
  collectCoverageFrom: [
    "services/**/*.{ts,js}",
    "shared/**/*.{ts,js}",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/dist/**",
    "!**/__tests__/**",
  ],
  setupFilesAfterEnv: ["./jest.setup.js"],
  globals: {
    "ts-jest": {
      isolatedModules: true,
    },
  },
};
