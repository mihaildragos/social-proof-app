import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { BadRequestError } from "./errorHandler";

// SCIM User schema
const scimUserSchema = z.object({
  schemas: z.array(z.string()).min(1),
  userName: z.string().min(1),
  name: z
    .object({
      givenName: z.string().optional(),
      familyName: z.string().optional(),
      formatted: z.string().optional(),
    })
    .optional(),
  emails: z
    .array(
      z.object({
        value: z.string().email(),
        type: z.string().optional(),
        primary: z.boolean().optional(),
      })
    )
    .optional(),
  active: z.boolean().optional(),
  externalId: z.string().optional(),
});

// SCIM Group schema
const scimGroupSchema = z.object({
  schemas: z.array(z.string()).min(1),
  displayName: z.string().min(1),
  members: z
    .array(
      z.object({
        value: z.string(),
        display: z.string().optional(),
      })
    )
    .optional(),
  externalId: z.string().optional(),
});

// SCIM Patch Operation schema
const scimPatchOpSchema = z.object({
  schemas: z.array(z.string()).min(1),
  Operations: z
    .array(
      z.object({
        op: z.enum(["add", "remove", "replace"]),
        path: z.string().optional(),
        value: z.any().optional(),
      })
    )
    .min(1),
});

// Map of schema types to their Zod validators
const schemaMap = {
  user: scimUserSchema,
  group: scimGroupSchema,
  patchOp: scimPatchOpSchema,
};

/**
 * Validates SCIM request payloads against Zod schemas
 * @param schemaType The type of SCIM schema to validate against
 */
export const validateScimRequest = (schemaType: keyof typeof schemaMap) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = schemaMap[schemaType];

      if (!schema) {
        throw new Error(`Invalid schema type: ${schemaType}`);
      }

      const validationResult = schema.safeParse(req.body);

      if (!validationResult.success) {
        const errorDetails = validationResult.error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));

        throw BadRequestError("Invalid SCIM payload", {
          details: errorDetails,
          schema: schemaType,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
