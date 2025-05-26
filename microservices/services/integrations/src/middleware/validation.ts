import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";

/**
 * Validation middleware factory
 * @param schema - Zod schema to validate against
 * @param source - Which part of the request to validate ('body', 'query', 'params', or 'all')
 */
export const validateRequest = (
  schema: AnyZodObject,
  source: "body" | "query" | "params" | "all" = "body"
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let dataToValidate: any;

      switch (source) {
        case "body":
          dataToValidate = req.body;
          break;
        case "query":
          dataToValidate = req.query;
          break;
        case "params":
          dataToValidate = req.params;
          break;
        case "all":
          dataToValidate = {
            body: req.body,
            query: req.query,
            params: req.params,
          };
          break;
        default:
          dataToValidate = req.body;
      }

      const validatedData = await schema.parseAsync(dataToValidate);

      // Replace the original data with validated data
      if (source === "body") {
        req.body = validatedData;
      } else if (source === "query") {
        req.query = validatedData;
      } else if (source === "params") {
        req.params = validatedData;
      } else if (source === "all") {
        req.body = validatedData.body;
        req.query = validatedData.query;
        req.params = validatedData.params;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        res.status(400).json({
          error: "Validation failed",
          details: errorMessages,
        });
        return;
      }

      console.error("Validation middleware error:", error);
      res.status(500).json({
        error: "Validation error",
        details: "An unexpected error occurred during validation",
      });
      return;
    }
  };
};

/**
 * Middleware to validate pagination parameters
 */
export const validatePagination = (req: Request, res: Response, next: NextFunction): void => {
  const { limit, offset, page } = req.query;

  // Validate limit
  if (limit !== undefined) {
    const limitNum = Number(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      res.status(400).json({
        error: "Invalid limit",
        details: "Limit must be a number between 1 and 100",
      });
      return;
    }
  }

  // Validate offset
  if (offset !== undefined) {
    const offsetNum = Number(offset);
    if (isNaN(offsetNum) || offsetNum < 0) {
      res.status(400).json({
        error: "Invalid offset",
        details: "Offset must be a non-negative number",
      });
      return;
    }
  }

  // Validate page
  if (page !== undefined) {
    const pageNum = Number(page);
    if (isNaN(pageNum) || pageNum < 1) {
      res.status(400).json({
        error: "Invalid page",
        details: "Page must be a positive number",
      });
      return;
    }
  }

  next();
};

/**
 * Middleware to validate date range parameters
 */
export const validateDateRange = (req: Request, res: Response, next: NextFunction): void => {
  const { startDate, endDate } = req.query;

  if (startDate) {
    const start = new Date(startDate as string);
    if (isNaN(start.getTime())) {
      res.status(400).json({
        error: "Invalid start date",
        details: "Start date must be a valid ISO 8601 date string",
      });
      return;
    }
  }

  if (endDate) {
    const end = new Date(endDate as string);
    if (isNaN(end.getTime())) {
      res.status(400).json({
        error: "Invalid end date",
        details: "End date must be a valid ISO 8601 date string",
      });
      return;
    }
  }

  if (startDate && endDate) {
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (start >= end) {
      res.status(400).json({
        error: "Invalid date range",
        details: "Start date must be before end date",
      });
      return;
    }
  }

  next();
};

/**
 * Middleware to validate required parameters
 */
export const validateRequiredParams = (requiredParams: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missingParams: string[] = [];

    for (const param of requiredParams) {
      if (!req.params[param]) {
        missingParams.push(param);
      }
    }

    if (missingParams.length > 0) {
      res.status(400).json({
        error: "Missing required parameters",
        details: `Required parameters: ${missingParams.join(", ")}`,
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to validate UUID parameters
 */
export const validateUUID = (paramNames: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const invalidParams: string[] = [];

    for (const paramName of paramNames) {
      const value = req.params[paramName];
      if (value && !uuidRegex.test(value)) {
        invalidParams.push(paramName);
      }
    }

    if (invalidParams.length > 0) {
      res.status(400).json({
        error: "Invalid UUID format",
        details: `Invalid UUID parameters: ${invalidParams.join(", ")}`,
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to sanitize input data
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Recursively sanitize object
  const sanitize = (obj: any): any => {
    if (typeof obj === "string") {
      // Basic XSS prevention
      return obj
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/\//g, "&#x2F;");
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }

    if (obj && typeof obj === "object") {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }

    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }

  if (req.query) {
    req.query = sanitize(req.query);
  }

  next();
};
