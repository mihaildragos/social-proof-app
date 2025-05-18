import crypto from "crypto";
import { logger } from "./logger";

// Encryption key from environment variable, with fallback for development
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "a-very-secure-32-chars-encryption-key";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // For AES, this is always 16 bytes
const AUTH_TAG_LENGTH = 16; // GCM auth tag length

/**
 * Encrypt sensitive data
 * @param data Data to encrypt
 * @returns Encrypted data as a hex-encoded string (IV + encrypted data + auth tag)
 */
export function encryptData(data: string): string {
  try {
    if (!data) return "";

    // Generate a random initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create a cipher
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    // Encrypt the data
    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get the authentication tag
    const authTag = cipher.getAuthTag();

    // Format as iv:encrypted:authTag (all hex encoded)
    return `${iv.toString("hex")}:${encrypted}:${authTag.toString("hex")}`;
  } catch (error) {
    logger.error("Encryption failed", { error: (error as Error).message });
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt sensitive data
 * @param encryptedData Encrypted data in the format IV:encryptedData:authTag
 * @returns Decrypted data as a string
 */
export function decryptData(encryptedData: string): string {
  try {
    if (!encryptedData) return "";

    // Split the encrypted data into IV, ciphertext, and auth tag
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format");
    }

    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];
    const authTag = Buffer.from(parts[2], "hex");

    // Create a decipher
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      Buffer.from(ENCRYPTION_KEY),
      iv,
      { authTagLength: AUTH_TAG_LENGTH }
    );

    // Set the auth tag
    decipher.setAuthTag(authTag);

    // Decrypt the data
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    logger.error("Decryption failed", { error: (error as Error).message });
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Encrypt specific fields in an object
 * Simple implementation that works with any object
 */
export function encryptFields(
  data: Record<string, unknown>,
  fields: string[]
): Record<string, unknown> {
  if (!data || typeof data !== "object") return data;

  const result = { ...data };

  for (const field of fields) {
    if (field in result && typeof result[field] === "string") {
      result[field] = encryptData(result[field] as string);
    }
  }

  return result;
}

/**
 * Decrypt specific fields in an object
 * Simple implementation that works with any object
 */
export function decryptFields(
  data: Record<string, unknown>,
  fields: string[]
): Record<string, unknown> {
  if (!data || typeof data !== "object") return data;

  const result = { ...data };

  for (const field of fields) {
    if (field in result && typeof result[field] === "string") {
      result[field] = decryptData(result[field] as string);
    }
  }

  return result;
}
