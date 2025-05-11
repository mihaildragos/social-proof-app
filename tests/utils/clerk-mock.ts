/**
 * Mock implementations for Clerk authentication in tests
 */

// Mock user data
const mockUser = {
  id: 'user_test123',
  firstName: 'Test',
  lastName: 'User',
  emailAddresses: [
    { 
      id: 'email_test123',
      emailAddress: 'test@example.com',
      verification: { status: 'verified' }
    }
  ],
  primaryEmailAddressId: 'email_test123'
};

// Auth function that returns a mocked user context
export const mockAuth = () => {
  return {
    userId: mockUser.id,
    getToken: async () => 'mock-token',
    has: () => true
  };
};

// Function that returns all mocked Clerk client functions
export const getMockClerk = () => {
  return {
    auth: mockAuth,
    clerkClient: {
      users: {
        getUser: async () => mockUser,
        getUserList: async () => [mockUser]
      },
      organizations: {
        getOrganizationMembershipList: async () => [],
        getOrganization: async () => ({ id: 'org_test123', name: 'Test Org' })
      }
    },
    currentUser: async () => mockUser
  };
}; 