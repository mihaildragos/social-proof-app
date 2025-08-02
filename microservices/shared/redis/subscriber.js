"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisSubscriber = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.getContextLogger)({ service: "redis-subscriber" });
/**
 * Redis subscriber class for handling pub/sub operations
 */
class RedisSubscriber {
    /**
     * Create a new Redis subscriber
     * @param redisUrl - Redis connection URL
     */
    constructor(redisUrl) {
        this.subscribers = new Map();
        // Use provided URL or default
        const url = redisUrl || process.env.REDIS_URL || "redis://localhost:6379";
        // Create Redis client
        this.client = new ioredis_1.default(url, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
        });
        // Set up error handler
        this.client.on("error", (err) => {
            logger.error("Redis subscriber error:", err);
        });
        // Set up message handler
        this.client.on("message", (channel, message) => {
            this.handleMessage(channel, message);
        });
    }
    /**
     * Subscribe to a Redis channel
     * @param channel - Channel name to subscribe to
     * @param callback - Function to call when a message is received
     */
    async subscribe(channel, callback) {
        try {
            // Get existing subscribers for this channel or create new array
            const callbacks = this.subscribers.get(channel) || [];
            // Add the new callback
            callbacks.push(callback);
            // Store updated callbacks
            this.subscribers.set(channel, callbacks);
            // If this is the first subscriber for this channel, subscribe at Redis level
            if (callbacks.length === 1) {
                await this.client.subscribe(channel);
                logger.info(`Subscribed to channel: ${channel}`);
            }
        }
        catch (error) {
            logger.error(`Error subscribing to channel ${channel}:`, error);
            throw error;
        }
    }
    /**
     * Unsubscribe from a Redis channel
     * @param channel - Channel name to unsubscribe from
     * @param callback - Optional specific callback to remove (if omitted, all callbacks are removed)
     */
    async unsubscribe(channel, callback) {
        try {
            const callbacks = this.subscribers.get(channel);
            if (!callbacks || callbacks.length === 0) {
                return;
            }
            if (callback) {
                // Remove specific callback
                const index = callbacks.indexOf(callback);
                if (index !== -1) {
                    callbacks.splice(index, 1);
                }
                // Update subscribers map
                this.subscribers.set(channel, callbacks);
            }
            else {
                // Remove all callbacks
                this.subscribers.delete(channel);
            }
            // If no more callbacks for this channel, unsubscribe at Redis level
            if (!this.subscribers.has(channel) || this.subscribers.get(channel).length === 0) {
                await this.client.unsubscribe(channel);
                logger.info(`Unsubscribed from channel: ${channel}`);
            }
        }
        catch (error) {
            logger.error(`Error unsubscribing from channel ${channel}:`, error);
            throw error;
        }
    }
    /**
     * Handle incoming messages from Redis
     * @param channel - Channel the message was received on
     * @param message - Message content
     */
    handleMessage(channel, message) {
        const callbacks = this.subscribers.get(channel);
        if (callbacks && callbacks.length > 0) {
            // Call all subscribers for this channel
            callbacks.forEach((callback) => {
                try {
                    callback(message);
                }
                catch (error) {
                    logger.error(`Error in subscriber callback for channel ${channel}:`, error);
                }
            });
        }
    }
    /**
     * Close the Redis connection
     */
    async disconnect() {
        try {
            await this.client.quit();
            logger.info("Redis subscriber disconnected");
        }
        catch (error) {
            logger.error("Error disconnecting Redis subscriber:", error);
            throw error;
        }
    }
}
exports.RedisSubscriber = RedisSubscriber;
exports.default = RedisSubscriber;
//# sourceMappingURL=subscriber.js.map