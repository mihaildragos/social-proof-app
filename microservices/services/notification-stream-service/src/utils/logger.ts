// Simple logger utility for notification stream service
export const getContextLogger = (context: { service: string }) => {
  const prefix = `[${context.service.toUpperCase()}]`;
  
  return {
    info: (message: string, meta?: any) => {
      console.log(`${prefix} INFO: ${message}`, meta || '');
    },
    
    warn: (message: string, meta?: any) => {
      console.warn(`${prefix} WARN: ${message}`, meta || '');
    },
    
    error: (message: string, error?: any, meta?: any) => {
      console.error(`${prefix} ERROR: ${message}`, error || '', meta || '');
    },
    
    debug: (message: string, meta?: any) => {
      console.debug(`${prefix} DEBUG: ${message}`, meta || '');
    }
  };
}; 