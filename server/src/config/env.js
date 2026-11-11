import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const configDir = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(configDir, "../..");
const envPath = resolve(serverRoot, ".env");

export function loadEnv() {
  dotenv.config({ path: envPath });
}

export function configuredClientOrigins(env = process.env) {
  return String(env.CLIENT_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function validateRuntimeEnv(env = process.env) {
  const errors = [];
  const production = env.NODE_ENV === "production";
  const mongoUri = String(env.MONGO_URI || "").trim();
  const jwtSecret = String(env.JWT_SECRET || "");
  const origins = configuredClientOrigins(env);

  if (!/^mongodb(?:\+srv)?:\/\//i.test(mongoUri)) {
    errors.push("MONGO_URI must be a valid mongodb:// or mongodb+srv:// connection string");
  }
  if (jwtSecret.length < 32 || /replace-with-a-unique-secret/i.test(jwtSecret)) {
    errors.push("JWT_SECRET must be a unique secret containing at least 32 characters");
  }
  if (production && origins.length === 0) {
    errors.push("CLIENT_ORIGIN must contain at least one explicit HTTPS frontend origin in production");
  }

  for (const origin of origins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      errors.push("CLIENT_ORIGIN contains an invalid URL: " + origin);
      continue;
    }
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== origin) {
      errors.push("CLIENT_ORIGIN entries must be origin-only HTTP(S) URLs: " + origin);
    }
    if (production && (parsed.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname))) {
      errors.push("Production CLIENT_ORIGIN entries must use public HTTPS origins");
    }
  }

  return { valid: errors.length === 0, errors };
}
