import jwt from "jsonwebtoken";
import { z } from "zod";
import { User } from "../models/User.js";

const staffRoles = ["director", "admin", "reception", "doctor", "therapist", "accounts", "coordinator"];

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid staff email address"),
  password: z.string().min(1, "Password is required")
});

const registerStaffSchema = z.object({
  name: z.string().trim().min(2, "Staff name is required"),
  email: z.string().trim().email("Enter a valid staff email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(staffRoles).default("reception")
});

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "8h" });
}

export async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400);
      throw new Error(parsed.error.issues[0]?.message || "Please check your login details");
    }

    const { email, password } = parsed.data;
    const user = await User.findOne({ email: email.toLowerCase(), isActive: true });

    if (!user || !(await user.comparePassword(password))) {
      res.status(401);
      throw new Error("Invalid email or password");
    }

    res.json({
      token: signToken(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    next(error);
  }
}

export async function registerStaff(req, res, next) {
  try {
    const parsed = registerStaffSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400);
      throw new Error(parsed.error.issues[0]?.message || "Please check the staff details");
    }

    const { name, email, password, role } = parsed.data;
    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ name, email, passwordHash, role });
    res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    next(error);
  }
}
