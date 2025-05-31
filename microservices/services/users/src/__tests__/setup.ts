// Global test setup

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Jest setup file to fix TypeScript mock typing issues
declare global {
  namespace jest {
    interface MockedFunction<T extends (...args: any[]) => any> {
      mockResolvedValue(value: any): this;
      mockRejectedValue(value: any): this;
      mockReturnValue(value: any): this;
    }
  }
}

export {};
