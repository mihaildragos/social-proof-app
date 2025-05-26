/**
 * Redis subscriber class for handling pub/sub operations
 */
export declare class RedisSubscriber {
    private client;
    private subscribers;
    /**
     * Create a new Redis subscriber
     * @param redisUrl - Redis connection URL
     */
    constructor(redisUrl?: string);
    /**
     * Subscribe to a Redis channel
     * @param channel - Channel name to subscribe to
     * @param callback - Function to call when a message is received
     */
    subscribe(channel: string, callback: (message: string) => void): Promise<void>;
    /**
     * Unsubscribe from a Redis channel
     * @param channel - Channel name to unsubscribe from
     * @param callback - Optional specific callback to remove (if omitted, all callbacks are removed)
     */
    unsubscribe(channel: string, callback?: Function): Promise<void>;
    /**
     * Handle incoming messages from Redis
     * @param channel - Channel the message was received on
     * @param message - Message content
     */
    private handleMessage;
    /**
     * Close the Redis connection
     */
    disconnect(): Promise<void>;
}
export default RedisSubscriber;
//# sourceMappingURL=subscriber.d.ts.map