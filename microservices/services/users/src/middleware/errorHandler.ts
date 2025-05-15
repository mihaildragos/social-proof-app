import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Custom error types
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  details?: any;

  constructor(message: string, statusCode: number, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const BadRequestError = (message: string, details?: any) => {
  return new AppError(message, 400, details);
};

export const UnauthorizedError = (message: string, details?: any) => {
  return new AppError(message, 401, details);
};

export const ForbiddenError = (message: string, details?: any) => {
  return new AppError(message, 403, details);
};

export const NotFoundError = (message: string, details?: any) => {
  return new AppError(message, 404, details);
};

export const ConflictError = (message: string, details?: any) => {
  return new AppError(message, 409, details);
};

export const RateLimitError = (message: string, details?: any) => {
  return new AppError(message, 429, details);
};

export const ServerError = (message: string, details?: any) => {
  return new AppError(message, 500, details);
};

// SCIM-specific error response formatter
const formatScimError = (err: AppError) => {
  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    status: err.statusCode.toString(),
    scimType: getSCIMErrorType(err.statusCode),
    detail: err.message,
  };
};

// Map HTTP status codes to SCIM error types
const getSCIMErrorType = (statusCode: number): string => {
  switch (statusCode) {
    case 400:
      return 'invalidValue';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'resourceNotFound';
    case 409:
      return 'uniqueness';
    case 429:
      return 'tooMany';
    case 500:
    default:
      return 'serverError';
  }
};

// Central error handling middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = err;
  
  // If it's not our AppError, convert it
  if (!(error instanceof AppError)) {
    // Log original error
    logger.error('Unhandled error', {
      error: error.message,
      stack: error.stack,
      path: req.path,
    });
    
    // Convert to ServerError
    error = ServerError('An unexpected error occurred');
  } else {
    // Log AppError with appropriate level
    const logMethod = error.statusCode >= 500 ? 'error' : 'warn';
    logger[logMethod]('Application error', {
      statusCode: (error as AppError).statusCode,
      message: error.message,
      path: req.path,
      details: (error as AppError).details,
    });
  }
  
  const appError = error as AppError;
  
  // Check if it's a SCIM request
  const isScimRequest = req.path.startsWith('/scim/');
  
  if (isScimRequest) {
    // Format as SCIM error response
    return res.status(appError.statusCode).json(formatScimError(appError));
  }
  
  // Regular API error response
  res.status(appError.statusCode).json({
    status: 'error',
    message: appError.message,
    ...(process.env.NODE_ENV !== 'production' && { details: appError.details }),
  });
}; 