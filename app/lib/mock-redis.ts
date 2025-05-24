// Mock Redis implementation for local development

type Callback = (err: Error | null, result?: any) => void;
type RedisSubscribeCallback = (channel: string, message: string) => void;

class MockRedis {
  private data: Map<string, any> = new Map();
  private hashData: Map<string, Map<string, string>> = new Map();
  private listData: Map<string, any[]> = new Map();
  private subscribers: Map<string, RedisSubscribeCallback[]> = new Map();
  private expirations: Map<string, NodeJS.Timeout> = new Map();

  // Standard Redis methods
  set(key: string, value: any, callback?: Callback): Promise<"OK"> {
    this.data.set(key, value);
    if (callback) callback(null, "OK");
    return Promise.resolve("OK");
  }

  get(key: string, callback?: Callback): Promise<string | null> {
    const value = this.data.get(key) || null;
    if (callback) callback(null, value);
    return Promise.resolve(value);
  }

  // Hash methods
  hincrby(key: string, field: string, increment: number, callback?: Callback): Promise<number> {
    if (!this.hashData.has(key)) {
      this.hashData.set(key, new Map());
    }

    const hash = this.hashData.get(key)!;
    const currentValue = parseInt(hash.get(field) || "0");
    const newValue = currentValue + increment;
    hash.set(field, newValue.toString());

    if (callback) callback(null, newValue);
    return Promise.resolve(newValue);
  }

  hget(key: string, field: string, callback?: Callback): Promise<string | null> {
    const hash = this.hashData.get(key);
    const value = hash ? hash.get(field) || null : null;
    if (callback) callback(null, value);
    return Promise.resolve(value);
  }

  hset(key: string, field: string, value: string, callback?: Callback): Promise<number> {
    if (!this.hashData.has(key)) {
      this.hashData.set(key, new Map());
    }

    const hash = this.hashData.get(key)!;
    const isNew = !hash.has(field);
    hash.set(field, value);

    const result = isNew ? 1 : 0;
    if (callback) callback(null, result);
    return Promise.resolve(result);
  }

  // List methods
  lpush(key: string, value: any, callback?: Callback): Promise<number> {
    if (!this.listData.has(key)) {
      this.listData.set(key, []);
    }

    const list = this.listData.get(key)!;
    list.unshift(value);

    if (callback) callback(null, list.length);
    return Promise.resolve(list.length);
  }

  // Expiration methods
  expire(key: string, seconds: number, callback?: Callback): Promise<number> {
    // Clear any existing expiration
    if (this.expirations.has(key)) {
      clearTimeout(this.expirations.get(key)!);
    }

    // Set new expiration
    const timeout = setTimeout(() => {
      this.data.delete(key);
      this.hashData.delete(key);
      this.listData.delete(key);
      this.expirations.delete(key);
    }, seconds * 1000);

    this.expirations.set(key, timeout);

    if (callback) callback(null, 1);
    return Promise.resolve(1);
  }

  // Pub/Sub methods
  publish(channel: string, message: string, callback?: Callback): Promise<number> {
    const subscribers = this.subscribers.get(channel) || [];
    subscribers.forEach((cb) => cb(channel, message));
    const count = subscribers.length;
    if (callback) callback(null, count);
    return Promise.resolve(count);
  }

  subscribe(channel: string, callback?: Callback): void {
    // This is handled differently - callback is for confirmation only
    if (callback) callback(null, 1);
  }

  on(event: string, listener: RedisSubscribeCallback): this {
    if (event === "message") {
      // Register for all channels
      const allChannels = Array.from(this.subscribers.keys());
      for (const channel of allChannels) {
        if (!this.subscribers.has(channel)) {
          this.subscribers.set(channel, []);
        }
        this.subscribers.get(channel)!.push(listener);
      }
    }
    return this;
  }

  // Connection methods
  quit(): Promise<"OK"> {
    // Clean up all timers
    this.expirations.forEach((timeout) => clearTimeout(timeout));
    this.expirations.clear();
    return Promise.resolve("OK");
  }

  // Debug method to inspect mock data
  _debug(): any {
    return {
      data: Object.fromEntries(this.data.entries()),
      hashData: Object.fromEntries(
        Array.from(this.hashData.entries()).map(([key, hash]) => [
          key,
          Object.fromEntries(hash.entries()),
        ])
      ),
      listData: Object.fromEntries(this.listData.entries()),
      subscribers: Object.fromEntries(
        Array.from(this.subscribers.entries()).map(([key, callbacks]) => [key, callbacks.length])
      ),
    };
  }

  // Error simulation for testing
  simulateError(error: Error): void {
    this.emit("error", error);
  }

  private emit(event: string, ...args: any[]): void {
    // This would connect to any registered event listeners
    // For now, we're just using it for error simulation
  }
}

export default MockRedis;
