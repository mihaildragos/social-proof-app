import { useState, useCallback } from "react";
import { z } from "zod";
import {
  NotificationBuilderData,
  CreateNotificationResult,
} from "@/types/notifications";

// Validation schemas
const templateSchema = z.object({
  id: z.string().min(1, "Template is required"),
  name: z.string().min(1, "Template name is required"),
  type: z.enum(["purchase", "signup", "review", "visitor_count", "custom"]),
  content: z.object({
    title: z.string().min(1, "Title is required"),
    message: z.string().min(1, "Message is required"),
    image: z.string().optional(),
    cta: z
      .object({
        text: z.string().min(1, "CTA text is required"),
        url: z.string().url("Valid URL is required"),
      })
      .optional(),
  }),
  styling: z.object({
    position: z.enum(["top-left", "top-right", "bottom-left", "bottom-right", "center"]),
    theme: z.enum(["light", "dark", "custom"]),
    colors: z.object({
      background: z.string().min(1, "Background color is required"),
      text: z.string().min(1, "Text color is required"),
      accent: z.string().min(1, "Accent color is required"),
    }),
    animation: z.enum(["slide", "fade", "bounce", "none"]),
    duration: z.number().min(1000).max(10000),
  }),
});

const targetingSchema = z.object({
  segments: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1, "Segment name is required"),
        description: z.string(),
        rules: z
          .array(
            z.object({
              id: z.string(),
              type: z.enum([
                "page_url",
                "referrer",
                "device",
                "location",
                "time",
                "behavior",
                "custom",
              ]),
              operator: z.enum([
                "equals",
                "contains",
                "starts_with",
                "ends_with",
                "regex",
                "in",
                "not_in",
              ]),
              value: z.union([z.string(), z.array(z.string())]),
              description: z.string(),
            })
          )
          .min(1, "At least one targeting rule is required"),
        logic: z.enum(["AND", "OR"]),
      })
    )
    .min(1, "At least one audience segment is required"),
  triggers: z
    .array(
      z.object({
        id: z.string(),
        event: z.enum([
          "page_view",
          "time_on_page",
          "scroll_depth",
          "exit_intent",
          "click",
          "form_submit",
        ]),
        conditions: z.object({
          delay: z.number().optional(),
          scrollPercentage: z.number().min(0).max(100).optional(),
          elementSelector: z.string().optional(),
          pageViews: z.number().min(1).optional(),
        }),
        frequency: z.enum(["once", "session", "daily", "always"]),
      })
    )
    .min(1, "At least one trigger is required"),
  frequency: z.object({
    maxPerSession: z.number().min(1),
    maxPerDay: z.number().min(1),
    cooldownMinutes: z.number().min(0),
  }),
});

const abTestSchema = z
  .object({
    enabled: z.boolean(),
    name: z.string().min(1, "A/B test name is required").optional(),
    variants: z
      .array(
        z.object({
          id: z.string(),
          name: z.string().min(1, "Variant name is required"),
          weight: z.number().min(0).max(100),
          template: templateSchema,
          isControl: z.boolean(),
        })
      )
      .min(2, "At least 2 variants are required for A/B testing")
      .optional(),
    duration: z
      .object({
        startDate: z.date(),
        endDate: z.date(),
      })
      .optional(),
    goals: z
      .object({
        primary: z.enum(["clicks", "conversions", "engagement", "revenue"]),
        secondary: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.enabled) {
        return data.name && data.variants && data.duration && data.goals;
      }
      return true;
    },
    {
      message: "All A/B test fields are required when A/B testing is enabled",
    }
  );

const scheduleSchema = z
  .object({
    type: z.enum(["immediate", "scheduled", "recurring"]),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    timezone: z.string().min(1, "Timezone is required"),
    recurring: z
      .object({
        frequency: z.enum(["daily", "weekly", "monthly"]),
        daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
        timeSlots: z
          .array(
            z.object({
              start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
              end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
            })
          )
          .min(1, "At least one time slot is required"),
      })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.type === "scheduled") {
        return data.startDate;
      }
      if (data.type === "recurring") {
        return data.startDate && data.recurring;
      }
      return true;
    },
    {
      message:
        "Start date is required for scheduled campaigns, and recurring settings are required for recurring campaigns",
    }
  );

const initialData: NotificationBuilderData = {
  metadata: {
    name: "",
    description: "",
    siteId: "",
    createdBy: "",
    tags: [],
  },
};

export function useNotificationBuilder() {
  const [notificationData, setNotificationData] = useState<NotificationBuilderData>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const updateNotificationData = useCallback((updates: Partial<NotificationBuilderData>) => {
    setNotificationData((prev) => ({
      ...prev,
      ...updates,
    }));
    // Clear errors for updated fields
    const updatedFields = Object.keys(updates);
    setErrors((prev) => {
      const newErrors = { ...prev };
      updatedFields.forEach((field) => {
        delete newErrors[field];
      });
      return newErrors;
    });
  }, []);

  const validateStep = useCallback(
    async (stepId: string, data: NotificationBuilderData): Promise<boolean> => {
      try {
        switch (stepId) {
          case "template":
            if (!data.template) {
              setErrors({ template: ["Template is required"] });
              return false;
            }
            templateSchema.parse(data.template);
            break;

          case "targeting":
            if (!data.targeting) {
              setErrors({ targeting: ["Targeting configuration is required"] });
              return false;
            }
            targetingSchema.parse(data.targeting);
            break;

          case "ab-test":
            if (data.abTest) {
              abTestSchema.parse(data.abTest);
            }
            break;

          case "schedule":
            if (!data.schedule) {
              setErrors({ schedule: ["Schedule configuration is required"] });
              return false;
            }
            scheduleSchema.parse(data.schedule);
            break;

          case "preview":
            // Validate all previous steps for preview
            if (!data.template || !data.targeting || !data.schedule) {
              setErrors({ preview: ["All previous steps must be completed"] });
              return false;
            }
            templateSchema.parse(data.template);
            targetingSchema.parse(data.targeting);
            scheduleSchema.parse(data.schedule);
            if (data.abTest) {
              abTestSchema.parse(data.abTest);
            }
            break;

          default:
            return true;
        }

        setErrors({});
        return true;
      } catch (error) {
        if (error instanceof z.ZodError) {
          const fieldErrors: Record<string, string[]> = {};
          error.errors.forEach((err) => {
            const field = err.path.join(".");
            if (!fieldErrors[field]) {
              fieldErrors[field] = [];
            }
            fieldErrors[field].push(err.message);
          });
          setErrors(fieldErrors);
        }
        return false;
      }
    },
    []
  );

  const createNotification = useCallback(
    async (data: NotificationBuilderData): Promise<CreateNotificationResult> => {
      setIsLoading(true);

      try {
        // Validate all data before submission
        const isValid = await validateStep("preview", data);
        if (!isValid) {
          return {
            success: false,
            error: "Validation failed. Please check all fields.",
          };
        }

        // Make API call to create notification
        const response = await fetch("/api/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to create notification");
        }

        const result = await response.json();

        return {
          success: true,
          data: {
            id: result.id,
            campaignId: result.campaignId,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "An unexpected error occurred",
        };
      } finally {
        setIsLoading(false);
      }
    },
    [validateStep]
  );

  const reset = useCallback(() => {
    setNotificationData(initialData);
    setErrors({});
    setIsLoading(false);
  }, []);

  const getValidationErrors = useCallback(
    (field: string): string[] => {
      return errors[field] || [];
    },
    [errors]
  );

  return {
    notificationData,
    updateNotificationData,
    validateStep,
    createNotification,
    reset,
    isLoading,
    errors,
    getValidationErrors,
  };
}
