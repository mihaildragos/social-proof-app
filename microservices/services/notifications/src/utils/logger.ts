import winston from 'winston';

interface LoggerOptions {
  serviceName?: string;
  level?: string;
  format?: 'json' | 'simple' | 'pretty';
}

export class Logger {
  private logger: winston.Logger;

  constructor(options: LoggerOptions = {}) {
    const {
      serviceName = 'notification-service',
      level = process.env.LOG_LEVEL || 'info',
      format = 'json'
    } = options;

    // Create formatter based on specified format
    let formatter: winston.Logform.Format;
    
    if (format === 'simple') {
      formatter = winston.format.simple();
    } else if (format === 'pretty') {
      formatter = winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf((info) => {
          // Using type assertion to handle the info object
          const timestamp = info.timestamp as string;
          const level = info.level as string;
          const message = info.message as string;
          
          // Filter out known properties for metadata
          const meta: Record<string, any> = { ...info };
          delete meta.timestamp;
          delete meta.level;
          delete meta.message;
          
          return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
        })
      );
    } else {
      formatter = winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      );
    }

    // Create the logger instance
    this.logger = winston.createLogger({
      level,
      defaultMeta: { service: serviceName },
      format: formatter,
      transports: [
        new winston.transports.Console({
          stderrLevels: ['error']
        })
      ]
    });

    // Add file transports if running in production
    if (process.env.NODE_ENV === 'production') {
      this.logger.add(
        new winston.transports.File({ 
          filename: 'logs/error.log', 
          level: 'error',
          maxsize: 10485760, // 10MB
          maxFiles: 10
        })
      );
      
      this.logger.add(
        new winston.transports.File({ 
          filename: 'logs/combined.log',
          maxsize: 10485760, // 10MB
          maxFiles: 10
        })
      );
    }
  }

  /**
   * Log at info level
   */
  public info(message: string, meta: Record<string, any> = {}): void {
    this.logger.info(message, meta);
  }

  /**
   * Log at error level
   */
  public error(message: string, error?: Error | unknown, meta: Record<string, any> = {}): void {
    let errorDetails: Record<string, any> = {};
    
    if (error instanceof Error) {
      errorDetails = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    } else if (error !== undefined) {
      errorDetails = { error };
    }
    
    this.logger.error(message, { ...meta, ...errorDetails });
  }

  /**
   * Log at warn level
   */
  public warn(message: string, meta: Record<string, any> = {}): void {
    this.logger.warn(message, meta);
  }

  /**
   * Log at debug level
   */
  public debug(message: string, meta: Record<string, any> = {}): void {
    this.logger.debug(message, meta);
  }

  /**
   * Log at verbose level
   */
  public verbose(message: string, meta: Record<string, any> = {}): void {
    this.logger.verbose(message, meta);
  }

  /**
   * Get the winston logger instance
   */
  public getLoggerInstance(): winston.Logger {
    return this.logger;
  }
} 