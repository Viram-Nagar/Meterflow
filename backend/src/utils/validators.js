/**
 * @file validators.js
 * @description Zod validation schemas for all API inputs.
 */

const { z } = require("zod");

// ── Auth Validators ───────────────────────────────────────────────────────────

const registerSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name cannot exceed 50 characters")
    .trim(),
  email: z
    .string({ required_error: "Email is required" })
    .email("Please provide a valid email")
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: "Password is required" })
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain uppercase, lowercase and number",
    ),
  company: z.string().max(100).trim().optional(),
  role: z.enum(["owner", "consumer"]).optional().default("owner"),
});

const loginSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .email("Please provide a valid email")
    .toLowerCase()
    .trim(),
  password: z.string({ required_error: "Password is required" }),
});

const changePasswordSchema = z.object({
  currentPassword: z.string({ required_error: "Current password is required" }),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain uppercase, lowercase and number",
    ),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).trim().optional(),
  company: z.string().max(100).trim().optional(),
});

// ── API Validators ────────────────────────────────────────────────────────────

const createAPISchema = z.object({
  name: z
    .string({ required_error: "API name is required" })
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters")
    .trim(),
  description: z.string().max(500).optional().default(""),
  category: z
    .enum([
      "weather",
      "finance",
      "crypto",
      "ai",
      "maps",
      "social",
      "ecommerce",
      "health",
      "sports",
      "news",
      "utilities",
      "other",
    ])
    .optional()
    .default("other"),
  baseUrl: z
    .string({ required_error: "Base URL is required" })
    .url("Must be a valid URL starting with http:// or https://")
    .trim(),
  targetAuth: z
    .object({
      type: z.enum(["none", "header", "query", "bearer"]).default("none"),
      key: z.string().optional().nullable(),
      value: z.string().optional().nullable(),
    })
    .optional(),
  pricing: z
    .object({
      freeQuota: z.number().min(0).default(1000),
      pricePerHundred: z.number().min(0).default(0.5),
      currency: z.string().default("INR"),
    })
    .optional(),
  rateLimit: z
    .object({
      requestsPerMinute: z.number().min(1).max(10000).default(60),
      requestsPerMonth: z.number().min(1).default(10000),
    })
    .optional(),
  timeout: z.number().min(1000).max(120000).optional().default(30000),
  isPublic: z.boolean().optional().default(false),
  tags: z.array(z.string()).max(10).optional().default([]),
});

const updateAPISchema = createAPISchema.partial();

// ── API Key Validators ────────────────────────────────────────────────────────

const generateKeySchema = z.object({
  name: z.string().max(100).optional(),
  description: z.string().max(300).optional(),
  tier: z.enum(["free", "pro", "enterprise"]).optional(),
  rateLimit: z
    .object({
      requestsPerMinute: z.number().min(1).optional(),
      requestsPerMonth: z.number().min(1).optional(),
    })
    .optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  allowedOrigins: z.array(z.string()).optional().default([]),
});

const revokeKeySchema = z.object({
  reason: z.string().max(300).optional(),
});

// ── Validation Middleware Factory ─────────────────────────────────────────────

/**
 * Creates Express middleware that validates req.body against a Zod schema
 * @param {ZodSchema} schema
 * @returns {Function} Express middleware
 */
const validate = (schema) => (req, res, next) => {
  // Safety check — if schema is undefined, skip validation
  if (!schema) {
    console.error("validate() called with undefined schema");
    return next();
  }
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

// ── Export ────────────────────────────────────────────────────────────────────

module.exports = {
  validate,
  schemas: {
    // Auth
    register: registerSchema,
    login: loginSchema,
    changePassword: changePasswordSchema,
    updateProfile: updateProfileSchema,
    // API
    createAPI: createAPISchema,
    updateAPI: updateAPISchema,
    // Keys
    generateKey: generateKeySchema,
    revokeKey: revokeKeySchema,
  },
};

// /**
//  * @file validators.js
//  * @description Zod validation schemas for all API inputs.
//  * Used in middleware to validate request body before hitting controller.
//  */

// const { z } = require("zod");

// // ── Auth Validators ───────────────────────────────────────────────────────────

// const registerSchema = z.object({
//   name: z
//     .string({ required_error: "Name is required" })
//     .min(2, "Name must be at least 2 characters")
//     .max(50, "Name cannot exceed 50 characters")
//     .trim(),

//   email: z
//     .string({ required_error: "Email is required" })
//     .email("Please provide a valid email")
//     .toLowerCase()
//     .trim(),

//   password: z
//     .string({ required_error: "Password is required" })
//     .min(8, "Password must be at least 8 characters")
//     .max(100, "Password too long")
//     .regex(
//       /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
//       "Password must contain at least one uppercase letter, one lowercase letter, and one number",
//     ),

//   company: z.string().max(100).trim().optional(),
//   role: z.enum(["owner", "consumer"]).optional().default("owner"),
// });

// const loginSchema = z.object({
//   email: z
//     .string({ required_error: "Email is required" })
//     .email("Please provide a valid email")
//     .toLowerCase()
//     .trim(),

//   password: z.string({ required_error: "Password is required" }),
// });

// const changePasswordSchema = z.object({
//   currentPassword: z.string({ required_error: "Current password is required" }),
//   newPassword: z
//     .string({ required_error: "New password is required" })
//     .min(8, "Password must be at least 8 characters")
//     .regex(
//       /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
//       "Password must contain uppercase, lowercase and number",
//     ),
// });

// const updateProfileSchema = z.object({
//   name: z.string().min(2).max(50).trim().optional(),
//   company: z.string().max(100).trim().optional(),
// });

// // ── API Validators ────────────────────────────────────────────────────────────

// const createAPISchema = z.object({
//   name: z
//     .string({ required_error: "API name is required" })
//     .min(2)
//     .max(100)
//     .trim(),
//   description: z.string().max(500).optional().default(""),
//   category: z
//     .enum([
//       "weather",
//       "finance",
//       "crypto",
//       "ai",
//       "maps",
//       "social",
//       "ecommerce",
//       "health",
//       "sports",
//       "news",
//       "utilities",
//       "other",
//     ])
//     .optional()
//     .default("other"),
//   baseUrl: z
//     .string({ required_error: "Base URL is required" })
//     .url("Must be a valid URL")
//     .trim(),
//   targetAuth: z
//     .object({
//       type: z.enum(["none", "header", "query", "bearer"]).default("none"),
//       key: z.string().optional().nullable(),
//       value: z.string().optional().nullable(),
//     })
//     .optional(),
//   pricing: z
//     .object({
//       freeQuota: z.number().min(0).default(1000),
//       pricePerHundred: z.number().min(0).default(0.5),
//       currency: z.string().default("INR"),
//     })
//     .optional(),
//   rateLimit: z
//     .object({
//       requestsPerMinute: z.number().min(1).max(10000).default(60),
//       requestsPerMonth: z.number().min(1).default(10000),
//     })
//     .optional(),
//   timeout: z.number().min(1000).max(120000).optional().default(30000),
//   isPublic: z.boolean().optional().default(false),
//   tags: z.array(z.string()).max(10).optional().default([]),
// });

// const updateAPISchema = createAPISchema.partial();

// const generateKeySchema = z.object({
//   name: z.string().max(100).optional(),
//   description: z.string().max(300).optional(),
//   tier: z.enum(["free", "pro", "enterprise"]).optional(),
//   rateLimit: z
//     .object({
//       requestsPerMinute: z.number().min(1).optional(),
//       requestsPerMonth: z.number().min(1).optional(),
//     })
//     .optional(),
//   expiresAt: z.string().datetime().optional().nullable(),
//   allowedOrigins: z.array(z.string().url()).optional().default([]),
// });

// const revokeKeySchema = z.object({
//   reason: z.string().max(300).optional(),
// });

// // ── Validation Middleware Factory ─────────────────────────────────────────────

// /**
//  * Creates Express middleware that validates req.body against a Zod schema
//  * @param {ZodSchema} schema
//  * @returns {Function} Express middleware
//  */
// const validate = (schema) => (req, res, next) => {
//   try {
//     // Parse and replace req.body with validated + transformed data
//     req.body = schema.parse(req.body);
//     next();
//   } catch (error) {
//     // Pass ZodError to global error handler
//     next(error);
//   }
// };

// module.exports = {
//   validate,
//   schemas: {
//     register: registerSchema,
//     login: loginSchema,
//     changePassword: changePasswordSchema,
//     updateProfile: updateProfileSchema,
//   },
// };
