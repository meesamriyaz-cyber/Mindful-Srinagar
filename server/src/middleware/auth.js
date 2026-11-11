import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
export async function protect(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Authentication required" });
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return res.status(503).json({ message: "Authentication is temporarily unavailable" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"], issuer: "mindful-srinagar", audience: "mindful-staff"
    });
    const user = await User.findById(decoded.id).select("name email role isActive");
    if (!user || !user.isActive) return res.status(401).json({ message: "This staff account is inactive or no longer exists" });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
export function permit(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: "You do not have permission for this action" });
    return next();
  };
}
