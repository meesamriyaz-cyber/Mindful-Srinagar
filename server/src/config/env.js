import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const configDir = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(configDir, "../..");
const envPath = resolve(serverRoot, ".env");

export function loadEnv() {
  dotenv.config({ path: envPath });
}
