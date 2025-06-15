import { describe, it, expect } from '@jest/globals';

describe('Shared Utilities', () => {
  // Mock utility functions
  const formatCurrency = (amount: number, currency = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const generateId = (prefix = ''): string => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
  };

  const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  const retry = async <T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    delayMs = 1000
  ): Promise<T> => {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (attempt === maxAttempts) {
          throw lastError;
        }
        await delay(delayMs * attempt);
      }
    }
    
    throw lastError!;
  };

  const chunk = <T>(array: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  const debounce = <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void => {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  const throttle = <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void => {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  };

  describe('formatCurrency', () => {
    it('should format USD currency correctly', () => {
      expect(formatCurrency(99.99)).toBe('$99.99');
      expect(formatCurrency(1000)).toBe('$1,000.00');
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should format different currencies', () => {
      expect(formatCurrency(99.99, 'EUR')).toBe('€99.99');
      expect(formatCurrency(99.99, 'GBP')).toBe('£99.99');
    });

    it('should handle negative amounts', () => {
      expect(formatCurrency(-99.99)).toBe('-$99.99');
    });

    it('should handle large numbers', () => {
      expect(formatCurrency(1234567.89)).toBe('$1,234,567.89');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should include prefix when provided', () => {
      const id = generateId('test');
      expect(id).toMatch(/^test_/);
    });

    it('should generate IDs without prefix', () => {
      const id = generateId();
      expect(id).toMatch(/^[a-z0-9]+_[a-z0-9]+$/);
    });

    it('should generate consistent format', () => {
      const id = generateId('user');
      expect(id).toMatch(/^user_[a-z0-9]+_[a-z0-9]+$/);
    });
  });

  describe('delay', () => {
    it('should delay execution', async () => {
      const start = Date.now();
      await delay(100);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });

    it('should handle zero delay', async () => {
      const start = Date.now();
      await delay(0);
      const end = Date.now();
      expect(end - start).toBeLessThan(50);
    });
  });

  describe('retry', () => {
    it('should succeed on first attempt', async () => {
      const successFn = jest.fn().mockResolvedValue('success');
      const result = await retry(successFn);
      expect(result).toBe('success');
      expect(successFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const failThenSucceedFn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');
      
      const result = await retry(failThenSucceedFn, 3, 10);
      expect(result).toBe('success');
      expect(failThenSucceedFn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max attempts', async () => {
      const alwaysFailFn = jest.fn().mockRejectedValue(new Error('always fail'));
      
      await expect(retry(alwaysFailFn, 2, 10)).rejects.toThrow('always fail');
      expect(alwaysFailFn).toHaveBeenCalledTimes(2);
    });

    it('should use default parameters', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('fail'));
      
      await expect(retry(failFn)).rejects.toThrow('fail');
      expect(failFn).toHaveBeenCalledTimes(3); // Default max attempts
    });
  });

  describe('chunk', () => {
    it('should split array into chunks', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const result = chunk(array, 3);
      expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    });

    it('should handle arrays not evenly divisible', () => {
      const array = [1, 2, 3, 4, 5];
      const result = chunk(array, 2);
      expect(result).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('should handle empty arrays', () => {
      const result = chunk([], 3);
      expect(result).toEqual([]);
    });

    it('should handle chunk size larger than array', () => {
      const array = [1, 2, 3];
      const result = chunk(array, 5);
      expect(result).toEqual([[1, 2, 3]]);
    });

    it('should handle chunk size of 1', () => {
      const array = [1, 2, 3];
      const result = chunk(array, 1);
      expect(result).toEqual([[1], [2], [3]]);
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should delay function execution', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('test');
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledWith('test');
    });

    it('should cancel previous calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('first');
      debouncedFn('second');
      debouncedFn('third');

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('third');
    });

    it('should handle multiple separate calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('first');
      jest.advanceTimersByTime(100);

      debouncedFn('second');
      jest.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenNthCalledWith(1, 'first');
      expect(mockFn).toHaveBeenNthCalledWith(2, 'second');
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should execute function immediately on first call', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn('test');
      expect(mockFn).toHaveBeenCalledWith('test');
    });

    it('should ignore subsequent calls within limit', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn('first');
      throttledFn('second');
      throttledFn('third');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('first');
    });

    it('should allow calls after limit period', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn('first');
      jest.advanceTimersByTime(100);
      throttledFn('second');

      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenNthCalledWith(1, 'first');
      expect(mockFn).toHaveBeenNthCalledWith(2, 'second');
    });
  });

  describe('Integration tests', () => {
    it('should work with retry and delay together', async () => {
      let attempts = 0;
      const flakeyFunction = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Not ready yet');
        }
        return 'success';
      };

      const result = await retry(flakeyFunction, 5, 10);
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should handle complex data with chunk', () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' },
        { id: 4, name: 'David' },
        { id: 5, name: 'Eve' }
      ];

      const batches = chunk(users, 2);
      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(2);
      expect(batches[1]).toHaveLength(2);
      expect(batches[2]).toHaveLength(1);
    });

    it('should generate unique IDs consistently', () => {
      const ids = Array.from({ length: 100 }, () => generateId('test'));
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(100); // All IDs should be unique
    });
  });
}); 