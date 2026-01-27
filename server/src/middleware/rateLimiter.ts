import rateLimit from "express-rate-limit";

/**
 * Global rate limiter - applies to all API endpoints
 * 100 requests per 15 minutes per IP
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" },
  // Skip rate limiting in test environment
  skip: () => process.env.NODE_ENV === "test",
});

/**
 * Strict rate limiter for auth endpoints
 * 5 attempts per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
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
