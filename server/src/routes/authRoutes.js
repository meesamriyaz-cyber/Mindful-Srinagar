import express from "express";
import { login, registerStaff } from "../controllers/authController.js";
import { permit, protect } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
const router = express.Router();
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 8, message: "Too many login attempts. Please wait before trying again." });
router.post("/login", loginLimiter, login);
router.post("/staff", protect, permit("director", "admin"), registerStaff);
export default router;
