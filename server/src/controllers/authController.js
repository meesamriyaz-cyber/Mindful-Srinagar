import jwt from "jsonwebtoken";
import { z } from "zod";
import { User } from "../models/User.js";
const staffRoles = ["director", "admin", "reception", "doctor", "therapist", "accounts", "coordinator"];
const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid staff email address").max(254),
  password: z.string().min(1, "Password is required").max(128)
}).strict();
const registerStaffSchema = z.object({
  name: z.string().trim().min(2, "Staff name is required").max(90),
  email: z.string().trim().email("Enter a valid staff email address").max(254),
  password: z.string().min(12, "Password must be at least 12 characters").max(128),
  role: z.enum(staffRoles).default("reception")
}).strict();
function signToken(user) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "4h", algorithm: "HS256", issuer: "mindful-srinagar", audience: "mindful-staff"
  });
}
export async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Please check your login details" });
    const { email, password } = parsed.data;
    const user = await User.findOne({ email: email.toLowerCase(), isActive: true });
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ message: "Invalid email or password" });
    return res.json({ token: signToken(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) { return next(error); }
}
export async function registerStaff(req, res, next) {
  try {
    const parsed = registerStaffSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Please check the staff details" });
    const { name, email, password, role } = parsed.data;
    if (req.user.role === "admin" && ["director", "admin"].includes(role)) {
      return res.status(403).json({ message: "Only a director can create director or administrator accounts" });
    }
    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ name, email, passwordHash, role });
    return res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (error) { return next(error); }
}
