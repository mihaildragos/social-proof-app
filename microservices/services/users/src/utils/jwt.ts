import { SignJWT, jwtVerify, JWTPayload } from "jose";
import { randomUUID } from "crypto";
import { logger } from "./logger";
import { prisma } from "../lib/prisma";

// JWT Claims interface
export interface JWTClaims extends JWTPayload {
  userId: string;
  email: string;
  organizationId?: string;
  sessionId?: string;
  role?: string;
  permissions?: string[];
}

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-for-development-only";
const JWT_ISSUER = process.env.JWT_ISSUER || "social-proof-app";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "social-proof-app-api";
const JWT_EXPIRES_IN = parseInt(process.env.TOKEN_EXPIRY || "86400", 10); // Default: 24 hours
const REFRESH_EXPIRES_IN = parseInt(process.env.REFRESH_TOKEN_EXPIRY || "2592000", 10); // Default: 30 days

/**
 * Generate access token for a user
 */
export async function generateToken(
  payload: Omit<JWTClaims, "iat" | "exp" | "nbf" | "iss" | "aud" | "jti">
): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(JWT_SECRET);

  const now = Math.floor(Date.now() / 1000);
  const jti = randomUUID();

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + JWT_EXPIRES_IN)
    .setNotBefore(now)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setJti(jti)
    .sign(secretKey);

  return token;
}

/**
 * Verify a JWT token and return the payload
 */
export async function verifyToken(token: string): Promise<JWTClaims> {
  try {
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(JWT_SECRET);

    const { payload } = await jwtVerify(token, secretKey, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (!payload.userId) {
      throw new Error("Invalid token: missing userId claim");
    }

    // Check if token is blacklisted
    const isBlacklisted = await checkTokenBlacklist(payload.jti as string);
    if (isBlacklisted) {
      throw new Error("Token has been revoked");
    }

    return payload as JWTClaims;
  } catch (error) {
    logger.warn("Token verification failed", { error: (error as Error).message });
    throw error;
  }
}

/**
 * Generate a refresh token
 */
export async function generateRefreshToken(userId: string, sessionId: string): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(JWT_SECRET);

  const now = Math.floor(Date.now() / 1000);
  const jti = randomUUID();

  const refreshToken = await new SignJWT({ userId, sessionId, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + REFRESH_EXPIRES_IN)
    .setNotBefore(now)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setJti(jti)
    .sign(secretKey);

  return refreshToken;
}

/**
 * Verify a refresh token
 */
export async function verifyRefreshToken(
  token: string
): Promise<{ userId: string; sessionId: string }> {
  try {
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(JWT_SECRET);

    const { payload } = await jwtVerify(token, secretKey, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (payload.type !== "refresh" || !payload.userId || !payload.sessionId) {
      throw new Error("Invalid refresh token");
    }

    // Check if token is blacklisted
    const isBlacklisted = await checkTokenBlacklist(payload.jti as string);
    if (isBlacklisted) {
      throw new Error("Refresh token has been revoked");
    }

    return {
      userId: payload.userId as string,
      sessionId: payload.sessionId as string,
    };
  } catch (error) {
    logger.warn("Refresh token verification failed", { error: (error as Error).message });
    throw error;
  }
}

/**
 * Add a token to the blacklist
 */
export async function blacklistToken(jti: string, expiresAt: number): Promise<void> {
  try {
    await prisma.tokenBlacklist.create({
      data: {
        tokenId: jti,
        expiresAt: new Date(expiresAt * 1000),
        createdAt: new Date(),
      },
    });
  } catch (error) {
    logger.error("Failed to blacklist token", { error: (error as Error).message, jti });
    throw error;
  }
}

/**
 * Check if a token is blacklisted
 */
async function checkTokenBlacklist(jti: string): Promise<boolean> {
  try {
    const blacklistedToken = await prisma.tokenBlacklist.findFirst({
      where: { tokenId: jti },
      select: { id: true },
    });

    return !!blacklistedToken;
  } catch (error) {
    logger.error("Failed to check token blacklist", { error: (error as Error).message, jti });
    return false;
  }
}
