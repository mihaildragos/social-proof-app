import { Request, Response, NextFunction } from "express";
import { z, ZodSchema, ZodError } from "zod";

export const validateRequest = (
  schema: ZodSchema,
  source: "body" | "query" | "params" = "body"
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const dataToValidate = req[source];
      const validatedData = schema.parse(dataToValidate);
      
      // Replace the original data with validated data
      (req as any)[source] = validatedData;
      
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
        details: error instanceof Error ? error.message : "Unknown error",
      });
      return;
    }
  };
};

export const validatePagination = (req: Request, res: Response, next: NextFunction): void => {
  const paginationSchema = z.object({
    limit: z.string().transform(Number).pipe(z.number().min(1).max(1000)).default("50"),
    offset: z.string().transform(Number).pipe(z.number().min(0)).default("0"),
  });

  try {
    const validatedQuery = paginationSchema.parse(req.query);
    req.query = { ...req.query, ...validatedQuery };
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: "Invalid pagination parameters",
        details: error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      });
      return;
    }

    next();
  }
};

export const validateDateRange = (req: Request, res: Response, next: NextFunction): void => {
  const dateRangeSchema = z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }).refine((data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  }, {
    message: "Start date must be before or equal to end date",
  });

  try {
    const validatedQuery = dateRangeSchema.parse(req.query);
    req.query = { ...req.query, ...validatedQuery };
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: "Invalid date range",
        details: error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      });
      return;
    }

    next();
  }
};

export const validateUUID = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const uuidSchema = z.string().uuid();
    
    try {
      const paramValue = req.params[paramName];
      uuidSchema.parse(paramValue);
      next();
    } catch (error) {
      res.status(400).json({
        error: `Invalid ${paramName}`,
        details: `${paramName} must be a valid UUID`,
      });
      return;
    }
  };
};

export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  const sanitizeObject = (obj: any): any => {
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
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === "object") {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  next();
};

export const validateTimeRange = (req: Request, res: Response, next: NextFunction): void => {
  const timeRangeSchema = z.object({
    timeRange: z.enum(["1h", "24h", "7d", "30d", "90d", "365d"]).optional(),
  });

  try {
    const validatedQuery = timeRangeSchema.parse(req.query);
    req.query = { ...req.query, ...validatedQuery };
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: "Invalid time range",
        details: "Time range must be one of: 1h, 24h, 7d, 30d, 90d, 365d",
      });
      return;
    }

    next();
  }
};

export const validateGranularity = (req: Request, res: Response, next: NextFunction): void => {
  const granularitySchema = z.object({
    granularity: z.enum(["minute", "hour", "day", "week", "month"]).optional(),
  });

  try {
    const validatedQuery = granularitySchema.parse(req.query);
    req.query = { ...req.query, ...validatedQuery };
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: "Invalid granularity",
        details: "Granularity must be one of: minute, hour, day, week, month",
      });
      return;
    }

    next();
  }
}; 