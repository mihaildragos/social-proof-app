import { NextFunction, Request, Response } from 'express';
import { logger } from './logger';

export enum ErrorType {
  VALIDATION_ERROR = 'ValidationError',
  AUTHENTICATION_ERROR = 'AuthenticationError',
  AUTHORIZATION_ERROR = 'AuthorizationError',
  NOT_FOUND_ERROR = 'NotFoundError',
  CONFLICT_ERROR = 'ConflictError',
  SERVICE_ERROR = 'ServiceError',
  DATABASE_ERROR = 'DatabaseError',
  EXTERNAL_SERVICE_ERROR = 'ExternalServiceError'
}

export interface AppError extends Error {
  type: ErrorType;
  statusCode: number;
  isOperational: boolean;
  details?: any;
}

class BaseError extends Error implements AppError {
  public readonly type: ErrorType;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(
    type: ErrorType,
    message: string,
    statusCode: number,
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    this.type = type;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends BaseError {
  constructor(message: string = 'Validation failed', details?: any) {
    super(ErrorType.VALIDATION_ERROR, message, 400, true, details);
  }
}

export class AuthenticationError extends BaseError {
  constructor(message: string = 'Authentication failed') {
    super(ErrorType.AUTHENTICATION_ERROR, message, 401);
  }
}

export class AuthorizationError extends BaseError {
  constructor(message: string = 'Not authorized') {
    super(ErrorType.AUTHORIZATION_ERROR, message, 403);
  }
}

export class NotFoundError extends BaseError {
  constructor(resource: string = 'Resource') {
    super(ErrorType.NOT_FOUND_ERROR, `${resource} not found`, 404);
  }
}

export class ConflictError extends BaseError {
  constructor(message: string = 'Resource already exists') {
    super(ErrorType.CONFLICT_ERROR, message, 409);
  }
}

export class ServiceError extends BaseError {
  constructor(message: string = 'Service error', details?: any) {
    super(ErrorType.SERVICE_ERROR, message, 500, true, details);
  }
}

export class DatabaseError extends BaseError {
  constructor(message: string = 'Database error', details?: any) {
    super(ErrorType.DATABASE_ERROR, message, 500, true, details);
  }
}

export class ExternalServiceError extends BaseError {
  constructor(service: string, message: string = 'External service error', details?: any) {
    super(
      ErrorType.EXTERNAL_SERVICE_ERROR,
      `${service} service error: ${message}`,
      502,
      true,
      details
    );
  }
}

// Error handler middleware for Express
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Default error values
  let statusCode = 500;
  let errorType = ErrorType.SERVICE_ERROR;
  let errorMessage = 'Internal server error';
  let errorDetails = undefined;
  let isOperational = false;

  // Check if error is one of our application errors
  if ('statusCode' in err && 'type' in err) {
    const appError = err as AppError;
    statusCode = appError.statusCode;
    errorType = appError.type;
    errorMessage = appError.message;
    errorDetails = appError.details;
    isOperational = appError.isOperational;
  } else if (err.name === 'ZodError') {
    // Handle Zod validation errors
    statusCode = 400;
    errorType = ErrorType.VALIDATION_ERROR;
    errorMessage = 'Validation failed';
    errorDetails = err;
    isOperational = true;
  } else if (err.name === 'JsonWebTokenError') {
    // Handle JWT errors
    statusCode = 401;
    errorType = ErrorType.AUTHENTICATION_ERROR;
    errorMessage = 'Invalid token';
    isOperational = true;
  } else if (err.name === 'TokenExpiredError') {
    // Handle JWT expiration
    statusCode = 401;
    errorType = ErrorType.AUTHENTICATION_ERROR;
    errorMessage = 'Token expired';
    isOperational = true;
  }

  // Log error
  if (isOperational) {
    logger.warn(`Operational error: ${errorMessage}`, { 
      errorType,
      statusCode,
      ...(errorDetails && { details: errorDetails })
    });
  } else {
    logger.logError('Unhandled error', err as Error, {
      path: req.path,
      method: req.method
    });
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      type: errorType,
      message: errorMessage,
      ...(process.env.NODE_ENV !== 'production' && errorDetails && { details: errorDetails })
    }
  });
};

// Function to handle uncaught exceptions and rejections
export const setupGlobalErrorHandlers = (): void => {
  process.on('uncaughtException', (error: Error) => {
    logger.logError('Uncaught Exception', error);
    console.error('UNCAUGHT EXCEPTION! Shutting down...');
    process.exit(1);
  });

  process.on('unhandledRejection', (error: Error) => {
    logger.logError('Unhandled Rejection', error);
    console.error('UNHANDLED REJECTION! Shutting down...');
    process.exit(1);
  });
}; 