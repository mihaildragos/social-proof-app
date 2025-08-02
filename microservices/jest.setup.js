// Jest setup file
const dotenv = require("dotenv");

// Load test environment variables
dotenv.config({ path: ".env.test" });

// Set test timeouts
jest.setTimeout(30000);

// Mock global services if needed
// For example, if you want to mock Kafka or Redis globally

// Setup global beforeAll and afterAll hooks if needed
beforeAll(async () => {
  // Global setup before running tests
  console.log("Starting test suite");
});

afterAll(async () => {
  // Global cleanup after all tests
  console.log("Finished test suite");
});
