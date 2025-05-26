import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";

/**
 * Validation middleware factory
 * @param schema - Zod schema to validate against
 * @param source - Which part of the request to validate ('body', 'query', 'params', or 'all')
 */
export const validateRequest = (schema: AnyZodObject, source: 'body' | 'query' | 'params' | 'all' = 'body') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let dataToValidate: any;

      switch (source) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        case 'all':
          dataToValidate = {
            body: req.body,
            query: req.query,
            params: req.params,
          };
          break;
        default:
          dataToValidate = req.body;
      }

      // Validate request against schema
      await schema.parseAsync(dataToValidate);

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        res.status(400).json({
          error: "Validation error",
          details: validationErrors,
        });
      } else {
        res.status(500).json({
          error: "Validation failed",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  };
};

/**
 * Middleware to validate UUID parameters
 */
export const validateUUID = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!value || !uuidRegex.test(value)) {
      res.status(400).json({
        error: "Invalid UUID",
        details: `Parameter '${paramName}' must be a valid UUID`,
      });
      return;
    }

    next();
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
 * Utility function to validate required parameters
 */
export const validateRequiredParam = (value: string | undefined, paramName: string): string => {
  if (!value) {
    throw new Error(`${paramName} is required`);
  }
  return value;
};

/**
 * Utility function to build options object without undefined values
 */
export const buildOptionsObject = <T extends Record<string, any>>(options: T): Partial<T> => {
  const result: Partial<T> = {};
  
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) {
      (result as any)[key] = value;
    }
  }
  
  return result;
}; 