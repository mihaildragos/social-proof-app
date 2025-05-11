import dotenv from 'dotenv';
import { randomBytes } from 'crypto';
import { resetMockDb } from '@/lib/test-db-mock';
import { mockAuth, getMockClerk } from './utils/clerk-mock';

// Load environment variables from .env file
dotenv.config({ path: '.env.test' });

// Set test mode environment variable
process.env.TEST_MODE = 'true';

// Mock environment variables for Supabase
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-url.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_KEY = 'test-key-for-testing-only';

// Set default timeout for all tests (30 seconds)
jest.setTimeout(30000);

// Mock Clerk modules
jest.mock('@clerk/nextjs/server', () => {
  const mockClerk = getMockClerk();
  return {
    auth: mockClerk.auth,
    clerkClient: mockClerk.clerkClient,
    currentUser: mockClerk.currentUser,
    clerkMiddleware: jest.fn().mockImplementation(() => (req: Request) => new Response())
  };
});

// Mock Supabase client for tests
jest.mock('@/utils/supabase/server', () => ({
  createClerkSupabaseClientSsr: jest.fn().mockImplementation(() => {
    // Create a mock Supabase client with all the methods needed
    const mockSupabase = {
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockImplementation(() => ({
          eq: jest.fn().mockImplementation(() => ({
            eq: jest.fn().mockImplementation(() => ({
              single: jest.fn().mockImplementation(() => Promise.resolve({ data: {}, error: null }))
            })),
            order: jest.fn().mockImplementation(() => Promise.resolve({ data: [], error: null })),
            single: jest.fn().mockImplementation(() => Promise.resolve({ data: {}, error: null }))
          })),
          insert: jest.fn().mockImplementation(() => ({
            select: jest.fn().mockImplementation(() => ({
              single: jest.fn().mockImplementation(() => Promise.resolve({ data: {}, error: null }))
            }))
          })),
          delete: jest.fn().mockImplementation(() => ({
            eq: jest.fn().mockImplementation(() => ({
              eq: jest.fn().mockImplementation(() => Promise.resolve({ error: null }))
            }))
          })),
          update: jest.fn().mockImplementation(() => ({
            eq: jest.fn().mockImplementation(() => ({
              eq: jest.fn().mockImplementation(() => ({
                select: jest.fn().mockImplementation(() => ({
                  single: jest.fn().mockImplementation(() => Promise.resolve({ data: {}, error: null }))
                }))
              }))
            }))
          }))
        }))
      }))
    };
    return mockSupabase;
  })
}));

// Mock createClient from @supabase/supabase-js
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockImplementation(() => {
    // Return the same mock client as above
    return {
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockImplementation(() => ({
          eq: jest.fn().mockImplementation(() => ({
            eq: jest.fn().mockImplementation(() => ({
              single: jest.fn().mockImplementation(() => Promise.resolve({ data: {}, error: null }))
            })),
            order: jest.fn().mockImplementation(() => Promise.resolve({ data: [], error: null })),
            single: jest.fn().mockImplementation(() => Promise.resolve({ data: {}, error: null }))
          })),
          insert: jest.fn().mockImplementation(() => ({
            select: jest.fn().mockImplementation(() => ({
              single: jest.fn().mockImplementation(() => Promise.resolve({ data: {}, error: null }))
            }))
          })),
          delete: jest.fn().mockImplementation(() => ({
            eq: jest.fn().mockImplementation(() => ({
              eq: jest.fn().mockImplementation(() => Promise.resolve({ error: null }))
            }))
          })),
          update: jest.fn().mockImplementation(() => ({
            eq: jest.fn().mockImplementation(() => ({
              eq: jest.fn().mockImplementation(() => ({
                select: jest.fn().mockImplementation(() => ({
                  single: jest.fn().mockImplementation(() => Promise.resolve({ data: {}, error: null }))
                }))
              }))
            }))
          }))
        }))
      }))
    };
  })
}));

// Create test ID namespace to avoid collisions in parallel test runs
export const testNamespace = randomBytes(4).toString('hex');

// Utility to generate unique test domains
export const generateTestDomain = () => {
  return `test-${randomBytes(4).toString('hex')}.example.com`;
};

// Global beforeAll hook
beforeAll(() => {
  console.log(`Running tests with namespace: ${testNamespace}`);
  
  // Check if we have authentication token for testing
  if (!process.env.TEST_AUTH_TOKEN) {
    console.warn('\x1b[33m%s\x1b[0m', 
      'WARNING: TEST_AUTH_TOKEN is not defined. Using mock authentication instead.'
    );
  }
});

// Reset mock database between tests
beforeEach(() => {
  resetMockDb();
});

// Global afterAll hook for cleanup if needed
afterAll(async () => {
  console.log('All tests completed');
});

// Declare globals for TypeScript
declare global {
  // eslint-disable-next-line no-var
  var testNamespace: string;
}

// Make the test namespace available globally
global.testNamespace = testNamespace; 