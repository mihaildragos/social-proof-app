/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured for you soon)
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: ['**/__tests__/**/*.test.(ts|js)', '**/*.test.(ts|js)'],
  // Add coverage settings if needed
  // collectCoverage: true,
  // collectCoverageFrom: ['**/*.{js,ts}', '!**/node_modules/**', '!**/tests/**'],
  transform: {
    // Add any transforms that are needed
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
}; 