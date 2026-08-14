import express from "express";
import { login, registerStaff } from "../controllers/authController.js";
import { permit, protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/login", login);
router.post("/staff", protect, permit("director", "admin"), registerStaff);

export default router;
