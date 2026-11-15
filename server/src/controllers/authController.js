import jwt from "jsonwebtoken";
import { z } from "zod";
import { User } from "../models/User.js";
import { sendPasswordResetEmail } from "../services/emailService.js";
import { createPasswordResetToken, hashPasswordResetToken, PASSWORD_RESET_TTL_MS } from "../security/passwordResetTokens.js";
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
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ message: "Invalid email or password" });
    if (!user.isActive) return res.status(403).json({ message: "Your staff account has been deactivated. Please contact the centre administrator." });
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


const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid staff email address").max(254)
}).strict();
const resetPasswordSchema = z.object({
  token: z.string().min(32).max(256),
  password: z.string().min(12, "Password must be at least 12 characters").max(128)
}).strict();

export async function requestPasswordReset(req, res, next) {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Enter a valid email address" });
    const genericMessage = "If an active staff account exists for that email, a password reset link will be sent shortly.";
    const user = await User.findOne({ email: parsed.data.email.toLowerCase(), isActive: true }).select("+passwordResetTokenHash +passwordResetExpiresAt");
    if (!user) return res.json({ message: genericMessage });

    const rawToken = createPasswordResetToken();
    user.passwordResetTokenHash = hashPasswordResetToken(rawToken);
    user.passwordResetExpiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await user.save();

    const frontendUrl = String(process.env.CLIENT_URL || process.env.CLIENT_ORIGIN || "").split(",")[0].trim().replace(/\/+$/, "");
    if (!frontendUrl) {
      user.passwordResetTokenHash = undefined;
      user.passwordResetExpiresAt = undefined;
      await user.save();
      console.error("Password reset email delivery is unavailable: CLIENT_URL is not configured");
      return res.json({ message: genericMessage });
    }
    const resetUrl = new URL("/", frontendUrl);
    resetUrl.searchParams.set("resetToken", rawToken);
    resetUrl.hash = "staff";
    try {
      await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl: resetUrl.toString() });
    } catch (error) {
      user.passwordResetTokenHash = undefined;
      user.passwordResetExpiresAt = undefined;
      await user.save();
      console.error("Password reset email delivery failed:", error.message);
      return res.json({ message: genericMessage });
    }
    return res.json({ message: genericMessage });
  } catch (error) { return next(error); }
}

export async function resetPassword(req, res, next) {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Please check the reset details" });
    const tokenHash = hashPasswordResetToken(parsed.data.token);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
      isActive: true
    }).select("+passwordResetTokenHash +passwordResetExpiresAt");
    if (!user) return res.status(400).json({ message: "This password reset link is invalid or has expired. Request a new one." });

    user.passwordHash = await User.hashPassword(parsed.data.password);
    user.passwordChangedAt = new Date();
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();
    return res.json({ message: "Your password has been reset. You can now sign in with your new password." });
  } catch (error) { return next(error); }
}
