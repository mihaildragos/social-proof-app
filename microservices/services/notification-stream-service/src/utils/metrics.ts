// Simple metrics utility for notification stream service
export const metrics = {
  increment: (name: string, tags?: Record<string, string>) => {
    console.log(`[METRIC] ${name} incremented`, tags);
  },

  gauge: (name: string, value: number, tags?: Record<string, string>) => {
    console.log(`[METRIC] ${name} set to ${value}`, tags);
  },

  histogram: (name: string, value: number, tags?: Record<string, string>) => {
    console.log(`[METRIC] ${name} recorded ${value}`, tags);
  },

  timer: (name: string, tags?: Record<string, string>) => {
    const start = Date.now();
    return {
      end: () => {
        const duration = Date.now() - start;
        console.log(`[METRIC] ${name} took ${duration}ms`, tags);
      },
    };
  },
};
