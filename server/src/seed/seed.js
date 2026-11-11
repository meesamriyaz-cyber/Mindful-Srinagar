import mongoose from "mongoose";
import { loadEnv } from "../config/env.js";
import { connectDb } from "../config/db.js";
import { User } from "../models/User.js";
loadEnv();
async function bootstrapAdmin() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_ADMIN_BOOTSTRAP !== "true") {
    throw new Error("Administrator bootstrap is disabled in production unless explicitly enabled.");
  }
  const { SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = process.env;
  if (!SEED_ADMIN_NAME || !SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    throw new Error("Set SEED_ADMIN_NAME, SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to bootstrap the first director account.");
  }
  if (SEED_ADMIN_PASSWORD.length < 12) throw new Error("The initial administrator password must contain at least 12 characters.");
  await connectDb(process.env.MONGO_URI);
  if (await User.exists({})) throw new Error("Administrator bootstrap aborted: staff accounts already exist. Use the staff management workflow.");
  const user = await User.create({
    name: SEED_ADMIN_NAME.trim(),
    email: SEED_ADMIN_EMAIL.trim().toLowerCase(),
    passwordHash: await User.hashPassword(SEED_ADMIN_PASSWORD),
    role: "director"
  });
  console.log("Initial director account created:", user.email);
}
bootstrapAdmin()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect(); });
