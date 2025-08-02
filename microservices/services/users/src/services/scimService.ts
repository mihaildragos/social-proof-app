import { BadRequestError, ConflictError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";

/**
 * Service for handling SCIM user and group provisioning
 */
class ScimService {
  /**
   * Retrieve users with pagination and filtering
   */
  async getUsers({ organizationId, startIndex = 1, count = 100, filter = "" }) {
    // Build where clause for filtering
    const whereClause: any = {
      organizationId: organizationId,
    };

    // Simple filter parsing (SCIM filters can be complex in practice)
    if (filter) {
      if (filter.includes("userName eq")) {
        const username = filter.match(/userName eq "([^"]+)"/)?.[1];
        if (username) {
          whereClause.scimUsername = username;
        }
      } else if (filter.includes("externalId eq")) {
        const externalId = filter.match(/externalId eq "([^"]+)"/)?.[1];
        if (externalId) {
          whereClause.externalId = externalId;
        }
      }
    }

    const offset = Math.max(0, startIndex - 1);

    // First get total count
    const total = await prisma.scimUser.count({
      where: whereClause,
    });

    // Get paginated users with user details
    const scimUsers = await prisma.scimUser.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            emailEncrypted: true,
            fullName: true,
            fullNameEncrypted: true,
          },
        },
      },
      orderBy: {
        scimUsername: "asc",
      },
      skip: offset,
      take: count,
    });

    // Transform to SCIM format
    const transformedUsers = scimUsers.map((scimUser) => ({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      id: scimUser.id,
      externalId: scimUser.externalId,
      userName: scimUser.scimUsername,
      name: {
        formatted: scimUser.user.fullName || scimUser.user.fullNameEncrypted || "",
      },
      emails: [
        {
          value: scimUser.user.email || scimUser.user.emailEncrypted || "",
          primary: true,
          type: "work",
        },
      ],
      active: scimUser.active,
      meta: {
        resourceType: "User",
        created: scimUser.createdAt,
        lastModified: scimUser.updatedAt,
      },
    }));

    return {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
      totalResults: total,
      startIndex,
      itemsPerPage: count,
      Resources: transformedUsers,
    };
  }

  /**
   * Get a user by ID
   */
  async getUserById({ organizationId, id }) {
    const scimUser = await prisma.scimUser.findFirst({
      where: {
        id: id,
        organizationId: organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            emailEncrypted: true,
            fullName: true,
            fullNameEncrypted: true,
          },
        },
      },
    });

    if (!scimUser) {
      return null;
    }

    // Transform to SCIM format
    return {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      id: scimUser.id,
      externalId: scimUser.externalId,
      userName: scimUser.scimUsername,
      name: {
        formatted: scimUser.user.fullName || scimUser.user.fullNameEncrypted || "",
      },
      emails: [
        {
          value: scimUser.user.email || scimUser.user.emailEncrypted || "",
          primary: true,
          type: "work",
        },
      ],
      active: scimUser.active,
      meta: {
        resourceType: "User",
        created: scimUser.createdAt,
        lastModified: scimUser.updatedAt,
      },
    };
  }

  /**
   * Create a new user via SCIM
   */
  async createUser({ organizationId, userData }) {
    // Use Prisma transaction
    return await prisma.$transaction(async (tx) => {
      // Check if user already exists by username or externalId
      if (userData.externalId) {
        const existingUser = await tx.scimUser.findFirst({
          where: {
            organizationId: organizationId,
            externalId: userData.externalId,
          },
        });

        if (existingUser) {
          throw ConflictError(`User with externalId ${userData.externalId} already exists`);
        }
      }

      const existingUsername = await tx.scimUser.findFirst({
        where: {
          organizationId: organizationId,
          scimUsername: userData.userName,
        },
      });

      if (existingUsername) {
        throw ConflictError(`User with userName ${userData.userName} already exists`);
      }

      // Extract primary email
      const email = userData.emails?.find((e) => e.primary)?.value || userData.emails?.[0]?.value;

      if (!email) {
        throw BadRequestError("Email is required");
      }

      // Create user
      const user = await tx.user.create({
        data: {
          email: email,
          emailEncrypted: email, // In production, this would be encrypted
          fullName:
            userData.name?.formatted ||
            `${userData.name?.givenName || ""} ${userData.name?.familyName || ""}`.trim() ||
            email.split("@")[0],
          fullNameEncrypted:
            userData.name?.formatted ||
            `${userData.name?.givenName || ""} ${userData.name?.familyName || ""}`.trim() ||
            email.split("@")[0],
          authProvider: "scim",
          authProviderId: userData.externalId || userData.userName,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Create SCIM user mapping
      const scimUser = await tx.scimUser.create({
        data: {
          userId: user.id,
          organizationId: organizationId,
          externalId: userData.externalId,
          scimUsername: userData.userName,
          active: userData.active !== undefined ? userData.active : true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Add user to organization
      await tx.organizationMember.create({
        data: {
          userId: user.id,
          organizationId: organizationId,
          role: "user",
          joinedAt: new Date(),
        },
      });

      // Return SCIM-formatted user
      return {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
        id: scimUser.id,
        externalId: userData.externalId,
        userName: userData.userName,
        name: userData.name,
        emails: userData.emails,
        active: userData.active !== undefined ? userData.active : true,
        meta: {
          resourceType: "User",
          created: scimUser.createdAt,
          lastModified: scimUser.updatedAt,
        },
      };
    });
  }

  // Remaining methods would be implemented with similar transaction handling
  async replaceUser({ organizationId, id, userData }) {
    // Implementation would update user details
    // For brevity, returning dummy SCIM user object
    return {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      id: id,
      userName: userData.userName,
      // ... other fields
    };
  }

  async updateUser({ organizationId, id, operations }) {
    // Implementation would apply patch operations
    // For brevity, returning dummy SCIM user object
    return {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      id: id,
      // ... other fields
    };
  }

  async deleteUser({ organizationId, id }) {
    // Implementation would delete the user
    return true;
  }

  // Similar methods for Groups (getGroups, getGroupById, etc.)
  async getGroups({ organizationId, startIndex = 1, count = 100, filter = "" }) {
    return {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
      totalResults: 0,
      startIndex,
      itemsPerPage: count,
      Resources: [],
    };
  }

  async getGroupById({ organizationId, id }) {
    return null; // Would implement actual group lookup
  }

  async createGroup({ organizationId, groupData }) {
    return {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
      id: "123",
      displayName: groupData.displayName,
      // ... other fields
    };
  }

  async replaceGroup({ organizationId, id, groupData }) {
    return {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
      id: id,
      displayName: groupData.displayName,
      // ... other fields
    };
  }

  async updateGroup({ organizationId, id, operations }) {
    return {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
      id: id,
      // ... other fields
    };
  }

  async deleteGroup({ organizationId, id }) {
    return true;
  }
}

export const scimService = new ScimService();
