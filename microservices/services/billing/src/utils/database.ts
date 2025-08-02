import { Pool, PoolClient } from "pg";
import { logger } from "./logger";

// Database connection pool
let pool: Pool | null = null;

/**
 * Initialize database connection pool
 */
export function initializeDatabase(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  pool = new Pool({
    connectionString,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  });

  // Handle pool errors
  pool.on("error", (err) => {
    logger.error("Unexpected error on idle client", { error: err });
  });

  // Handle pool connection
  pool.on("connect", () => {
    logger.info("Database pool connected");
  });

  logger.info("Database pool initialized");
  return pool;
}

/**
 * Get database connection pool
 */
export function getDatabase(): Pool {
  if (!pool) {
    return initializeDatabase();
  }
  return pool;
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const db = getDatabase();
    const client = await db.connect();
    try {
      await client.query("SELECT 1");
      logger.info("Database connection test successful");
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error("Database connection test failed", { error });
    return false;
  }
}

/**
 * Execute a query with automatic connection handling
 */
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const db = getDatabase();
  const client = await db.connect();
  
  try {
    const result = await client.query(text, params);
    return result.rows;
  } catch (error) {
    logger.error("Database query error", { error, query: text, params });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a query and return a single row
 */
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0]! : null;
}

/**
 * Execute multiple queries in a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const db = getDatabase();
  const client = await db.connect();
  
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Transaction error", { error });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close database connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info("Database pool closed");
  }
} 