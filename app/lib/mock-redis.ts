// Mock Redis implementation for local development

type Callback = (err: Error | null, result?: any) => void;
type RedisSubscribeCallback = (channel: string, message: string) => void;

class MockRedis {
  private data: Map<string, any> = new Map();
  private subscribers: Map<string, RedisSubscribeCallback[]> = new Map();
  
  // Standard Redis methods
  set(key: string, value: any, callback?: Callback): Promise<'OK'> {
    this.data.set(key, value);
    if (callback) callback(null, 'OK');
    return Promise.resolve('OK');
  }
  
  get(key: string, callback?: Callback): Promise<string | null> {
    const value = this.data.get(key) || null;
    if (callback) callback(null, value);
    return Promise.resolve(value);
  }
  
  // Pub/Sub methods
  publish(channel: string, message: string, callback?: Callback): Promise<number> {
    const subscribers = this.subscribers.get(channel) || [];
    subscribers.forEach(cb => cb(channel, message));
    const count = subscribers.length;
    if (callback) callback(null, count);
    return Promise.resolve(count);
  }
  
  subscribe(channel: string, callback?: Callback): void {
    // This is handled differently - callback is for confirmation only
    if (callback) callback(null, 1);
  }
  
  on(event: string, listener: RedisSubscribeCallback): this {
    if (event === 'message') {
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
  quit(): Promise<'OK'> {
    return Promise.resolve('OK');
  }
  
  // Error simulation for testing
  simulateError(error: Error): void {
    this.emit('error', error);
  }
  
  private emit(event: string, ...args: any[]): void {
    // This would connect to any registered event listeners
    // For now, we're just using it for error simulation
  }
}

export default MockRedis; 