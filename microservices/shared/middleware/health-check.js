"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const kafkajs_1 = require("kafkajs");
const ioredis_1 = __importDefault(require("ioredis"));
const pg_1 = require("pg");
/**
 * Health check middleware factory
 * @param serviceName - Name of the service
 * @param dependencies - Service dependencies to check
 * @returns Express router with health check endpoints
 */
function createHealthCheckMiddleware(serviceName, dependencies) {
    const router = (0, express_1.Router)();
    const startTime = Date.now();
    // Basic health check endpoint - quick response
    router.get("/health", (req, res) => {
        res.status(200).json({ status: "healthy", service: serviceName });
    });
    // Detailed health check endpoint - checks all dependencies
    router.get("/health/detailed", async (req, res) => {
        try {
            const result = {
                status: "healthy",
                version: process.env.VERSION || "1.0.0",
                uptime: Math.floor((Date.now() - startTime) / 1000),
                timestamp: new Date().toISOString(),
                components: {},
            };
            // Check components if dependencies are provided
            if (dependencies) {
                // Check Kafka connection
                if (dependencies.kafka) {
                    try {
                        const kafka = new kafkajs_1.Kafka({
                            clientId: dependencies.kafka.clientId,
                            brokers: dependencies.kafka.brokers,
                            logLevel: kafkajs_1.logLevel.ERROR,
                        });
                        const admin = kafka.admin();
                        await admin.connect();
                        const topics = await admin.listTopics();
                        await admin.disconnect();
                        result.components.kafka = {
                            status: "healthy",
                            details: { topics: topics.length },
                        };
                    }
                    catch (error) {
                        result.components.kafka = {
                            status: "unhealthy",
                            details: { error: error.message },
                        };
                        result.status = "degraded";
                    }
                }
                // Check Redis connection
                if (dependencies.redis) {
                    try {
                        const redis = new ioredis_1.default(dependencies.redis.url);
                        const pingResult = await redis.ping();
                        await redis.quit();
                        result.components.redis = {
                            status: pingResult === "PONG" ? "healthy" : "degraded",
                            details: { ping: pingResult },
                        };
                    }
                    catch (error) {
                        result.components.redis = {
                            status: "unhealthy",
                            details: { error: error.message },
                        };
                        result.status = "degraded";
                    }
                }
                // Check PostgreSQL connection
                if (dependencies.postgres) {
                    try {
                        const pool = new pg_1.Pool({
                            connectionString: dependencies.postgres.connectionString,
                            connectionTimeoutMillis: 5000,
                        });
                        const client = await pool.connect();
                        const dbResult = await client.query("SELECT 1 as result");
                        client.release();
                        await pool.end();
                        result.components.postgres = {
                            status: "healthy",
                            details: { result: dbResult.rows[0].result },
                        };
                    }
                    catch (error) {
                        result.components.postgres = {
                            status: "unhealthy",
                            details: { error: error.message },
                        };
                        result.status = "degraded";
                    }
                }
            }
            // Set response status based on health status
            const statusCode = result.status === "healthy" ? 200
                : result.status === "degraded" ? 207
                    : 503;
            res.status(statusCode).json(result);
        }
        catch (error) {
            res.status(500).json({
                status: "unhealthy",
                error: error.message,
            });
        }
    });
    return router;
}
exports.default = createHealthCheckMiddleware;
//# sourceMappingURL=health-check.js.map