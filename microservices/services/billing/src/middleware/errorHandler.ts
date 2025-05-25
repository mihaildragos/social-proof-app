import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

// Custom error classes
export class AppError extends Error {
  public statusCode: number;
  public code?: string;
  public details?: any;

  constructor(message: string, statusCode: number, code?: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code?: string, details?: any) {
    super(message, 400, code, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string, code?: string, details?: any) {
    super(message, 401, code, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string, code?: string, details?: any) {
    super(message, 403, code, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, code?: string, details?: any) {
    super(message, 404, code, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code?: string, details?: any) {
    super(message, 409, code, details);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string, code?: string, details?: any) {
    super(message, 500, code, details);
  }
}

// 404 Not Found handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
};

// Global error handler
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let code = "INTERNAL_ERROR";
  let message = "Internal server error";
  let details: any = undefined;

  // Handle custom AppError instances
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code || "APP_ERROR";
    message = error.message;
    details = error.details;
  }
  // Handle Stripe errors
  else if (error.name === "StripeError") {
    statusCode = 400;
    code = "STRIPE_ERROR";
    message = error.message;
  }
  // Handle validation errors
  else if (error.name === "ValidationError") {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = error.message;
  }
  // Handle database errors
  else if (error.name === "DatabaseError") {
    statusCode = 500;
    code = "DATABASE_ERROR";
    message = "Database operation failed";
  }
  // Handle generic errors
  else {
    message = error.message || "Internal server error";
  }

  // Log error
  logger.error("Request error", {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      statusCode,
      code,
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query,
    },
  });

  // Send error response
  res.status(statusCode).json({
    status: "error",
    code,
    message,
    ...(details && { details }),
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
};
