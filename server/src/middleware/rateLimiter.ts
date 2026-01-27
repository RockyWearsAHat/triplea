import rateLimit from "express-rate-limit";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Global rate limiter - applies to all API endpoints
 * Production: 200 requests per 15 minutes per IP
 * Development: 1000 requests per 15 minutes (more lenient for testing)
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 1000 : 200, // Higher limit for dev, reasonable for production
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" },
  // Skip rate limiting in test environment
  skip: () => process.env.NODE_ENV === "test",
});

/**
 * Strict rate limiter for auth endpoints
 * Production: 10 attempts per 15 minutes per IP
 * Development: 50 attempts per 15 minutes (more lenient for testing)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 50 : 10, // More attempts allowed, especially in dev
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later" },
  skip: () => process.env.NODE_ENV === "test",
});

/**
 * Moderate rate limiter for password reset
 * 3 attempts per hour per IP
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many password reset requests, please try again later",
  },
  skip: () => process.env.NODE_ENV === "test",
});

/**
 * Rate limiter for registration
 * 5 registrations per hour per IP
 */
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many registration attempts, please try again later",
  },
  skip: () => process.env.NODE_ENV === "test",
});

/**
 * Rate limiter for ticket purchases
 * 20 checkout attempts per 15 minutes per IP
 */
export const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many checkout attempts, please try again later" },
  skip: () => process.env.NODE_ENV === "test",
});
