import { z } from "zod";
import { Types } from "mongoose";

/**
 * Custom validator for MongoDB ObjectId
 */
export const objectIdSchema = z
  .string()
  .refine((val) => Types.ObjectId.isValid(val), {
    message: "Invalid ID format",
  });

/**
 * Gig creation/update validation
 */
export const createGigSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title too long")
    .trim(),
  description: z.string().max(5000, "Description too long").optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  time: z.string().max(20).optional(),
  budget: z.number().positive("Budget must be positive").optional(),
  locationId: objectIdSchema.optional(),
  location: z
    .object({
      name: z.string().min(1).max(200).trim(),
      address: z.string().max(500).optional(),
      city: z.string().max(100).optional(),
    })
    .optional(),
});

export type CreateGigInput = z.infer<typeof createGigSchema>;

/**
 * Location creation validation
 */
export const createLocationSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long").trim(),
  address: z.string().max(500, "Address too long").optional(),
  city: z.string().max(100, "City too long").optional(),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;

/**
 * Chat message validation
 */
export const createMessageSchema = z.object({
  body: z
    .string()
    .min(1, "Message cannot be empty")
    .max(10000, "Message too long")
    .trim(),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;

/**
 * Conversation creation validation
 */
export const createConversationSchema = z.object({
  participantIds: z
    .array(objectIdSchema)
    .min(1, "At least one participant required")
    .max(50, "Too many participants"),
  title: z.string().max(200, "Title too long").optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;

/**
 * Password validation (12 char minimum per security audit)
 */
export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password too long");

/**
 * User registration validation
 */
export const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").trim(),
  email: z.string().email("Invalid email format").max(255).trim().toLowerCase(),
  password: passwordSchema,
  roles: z
    .array(z.enum(["customer", "musician"]))
    .max(1)
    .optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Login validation
 */
export const loginSchema = z.object({
  email: z.string().email("Invalid email format").max(255).trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Ticket scan validation
 */
export const scanTicketSchema = z.object({
  qrPayload: z
    .string()
    .min(1, "QR payload is required")
    .max(5000, "Payload too large"),
  gigId: objectIdSchema.optional(),
});

export type ScanTicketInput = z.infer<typeof scanTicketSchema>;

/**
 * Helper to validate request body and return errors
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
): { success: true; data: T } | { success: false; errors: z.ZodIssue[] } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

/**
 * Format Zod errors for API response
 */
export function formatZodErrors(errors: z.ZodIssue[]): string {
  return errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
}
