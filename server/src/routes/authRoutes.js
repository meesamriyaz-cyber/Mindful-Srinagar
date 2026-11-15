import express from "express";
import { createHash } from "node:crypto";
import { login, registerStaff, requestPasswordReset, resetPassword } from "../controllers/authController.js";
import { permit, protect } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
const router = express.Router();
const passwordResetIpLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 30, message: "Too many password reset requests from this network. Please try again later." });
const passwordResetEmailLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: "Too many password reset requests for this email. Please try again later.",
  keyGenerator: (req) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    return email ? createHash("sha256").update(email).digest("hex") : (req.ip || req.socket?.remoteAddress || "unknown");
  }
});
const passwordResetLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 8, message: "Too many password reset attempts. Please try again later." });
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 8, message: "Too many login attempts. Please wait before trying again." });
router.post("/login", loginLimiter, login);
router.post("/forgot-password", passwordResetIpLimiter, passwordResetEmailLimiter, requestPasswordReset);
router.post("/reset-password", passwordResetLimiter, resetPassword);
router.post("/staff", protect, permit("director", "admin"), registerStaff);
export default router;
