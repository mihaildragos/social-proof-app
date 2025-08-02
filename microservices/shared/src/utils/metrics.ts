interface MetricsInterface {
  increment(name: string, tags?: Record<string, string>): void;
  histogram(name: string, value: number, tags?: Record<string, string>): void;
  gauge(name: string, value: number, tags?: Record<string, string>): void;
}

class MockMetrics implements MetricsInterface {
  increment(name: string, tags?: Record<string, string>): void {
    console.log(`[METRICS] Counter ${name} incremented`, tags);
  }

  histogram(name: string, value: number, tags?: Record<string, string>): void {
    console.log(`[METRICS] Histogram ${name}: ${value}`, tags);
  }

  gauge(name: string, value: number, tags?: Record<string, string>): void {
    console.log(`[METRICS] Gauge ${name}: ${value}`, tags);
  }
}

// Export a singleton instance
export const metrics: MetricsInterface = new MockMetrics();

export { MetricsInterface };
