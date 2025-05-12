/**
 * Configuration for the notifications service.
 * Uses environment variables with sensible defaults for local development.
 */

import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface KafkaConfig {
  brokers: string[];
  groupId: string;
  topics: string[];
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
  ssl?: boolean;
}

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  tls?: boolean;
}

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number; // max connections
  idleTimeoutMillis?: number;
}

interface Config {
  port: number;
  environment: string;
  logLevel: string;
  kafka: KafkaConfig;
  redis: RedisConfig;
  database: DatabaseConfig;
}

// Helper to get an environment variable or use default value
function getEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

// Helper to get a boolean environment variable
function getBoolEnv(key: string, defaultValue: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) {
    return defaultValue;
  }
  return val.toLowerCase() === 'true';
}

// Helper to get an integer environment variable
function getIntEnv(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Helper to get a comma-separated array environment variable
function getArrayEnv(key: string, defaultValue: string[]): string[] {
  const val = process.env[key];
  if (val === undefined) {
    return defaultValue;
  }
  return val.split(',').map(v => v.trim());
}

export const config: Config = {
  port: getIntEnv('PORT', 3000),
  environment: getEnv('NODE_ENV', 'development'),
  logLevel: getEnv('LOG_LEVEL', 'info'),
  
  kafka: {
    brokers: getArrayEnv('KAFKA_BROKERS', ['localhost:9092']),
    groupId: getEnv('KAFKA_GROUP_ID', 'notifications-service'),
    topics: getArrayEnv('KAFKA_TOPICS', ['events.orders', 'events.customers']),
    sasl: process.env.KAFKA_SASL_USERNAME ? {
      mechanism: 'plain',
      username: getEnv('KAFKA_SASL_USERNAME', ''),
      password: getEnv('KAFKA_SASL_PASSWORD', '')
    } : undefined,
    ssl: getBoolEnv('KAFKA_SSL', false)
  },
  
  redis: {
    host: getEnv('REDIS_HOST', 'localhost'),
    port: getIntEnv('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: getBoolEnv('REDIS_TLS', false)
  },
  
  database: {
    host: getEnv('DB_HOST', 'localhost'),
    port: getIntEnv('DB_PORT', 5432),
    database: getEnv('DB_NAME', 'notifications'),
    user: getEnv('DB_USER', 'postgres'),
    password: getEnv('DB_PASSWORD', 'postgres'),
    ssl: getBoolEnv('DB_SSL', false),
    max: getIntEnv('DB_MAX_CONNECTIONS', 20),
    idleTimeoutMillis: getIntEnv('DB_IDLE_TIMEOUT', 30000)
  }
}; 