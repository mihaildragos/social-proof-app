import { Pool } from 'pg';
import { logger } from './logger';

// Create a pool instance using environment variables
export const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection couldn't be established
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Set app.current_user_id when beginning a transaction
export const beginTransaction = async (userId?: string) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (userId) {
      await client.query(`SET LOCAL app.current_user_id = '${userId}'`);
    }
    return client;
  } catch (error) {
    client.release();
    throw error;
  }
};

// Helper for queries with automatic error handling
export const db = {
  query: async (text: string, params: any[] = []) => {
    const start = Date.now();
    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries (> 100ms) for performance monitoring
      if (duration > 100) {
        logger.warn('Slow query detected', {
          query: text,
          duration,
          rows: result.rowCount,
        });
      }
      
      return result;
    } catch (error) {
      const err = error as Error;
      logger.error('Database query error', {
        query: text,
        error: err.message,
        code: (err as any).code,
      });
      throw error;
    }
  },
  
  getOne: async <T = any>(text: string, params: any[] = []): Promise<T | null> => {
    const result = await db.query(text, params);
    return result.rows[0] || null;
  },
  
  getMany: async <T = any>(text: string, params: any[] = []): Promise<T[]> => {
    const result = await db.query(text, params);
    return result.rows;
  },
  
  // For inserts, updates, deletes
  execute: async (text: string, params: any[] = []): Promise<number> => {
    const result = await db.query(text, params);
    return result.rowCount;
  },
};

// Log pool errors
pool.on('error', (err: Error) => {
  logger.error('Unexpected error on idle client', { error: err.message });
  process.exit(-1);
}); 