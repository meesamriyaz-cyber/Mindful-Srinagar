import test from "node:test";
import assert from "node:assert/strict";
import { configuredClientOrigins, validateRuntimeEnv } from "../config/env.js";

const base = {
  NODE_ENV: "development",
  MONGO_URI: "mongodb://127.0.0.1:27017/mindful_test",
  JWT_SECRET: "a-test-secret-that-is-long-enough-for-validation",
  CLIENT_ORIGIN: "http://localhost:5173"
};

test("development runtime accepts local MongoDB and local frontend origins", () => {
  assert.deepEqual(validateRuntimeEnv(base), { valid: true, errors: [] });
});

test("production runtime requires explicit HTTPS frontend origins", () => {
  const result = validateRuntimeEnv({ ...base, NODE_ENV: "production", CLIENT_ORIGIN: "" });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /CLIENT_ORIGIN/);
});

test("production runtime rejects insecure or local frontend origins", () => {
  const result = validateRuntimeEnv({ ...base, NODE_ENV: "production" });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /public HTTPS/);
});

test("production runtime accepts explicit public HTTPS origins", () => {
  const result = validateRuntimeEnv({
    ...base,
    NODE_ENV: "production",
    CLIENT_ORIGIN: "https://mindful.example.org,https://staff.example.org"
  });
  assert.deepEqual(result, { valid: true, errors: [] });
});

test("runtime rejects missing MongoDB URI and weak or placeholder JWT secrets", () => {
  const result = validateRuntimeEnv({ ...base, MONGO_URI: "", JWT_SECRET: "replace-with-a-unique-secret" });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /MONGO_URI/);
  assert.match(result.errors.join(" "), /JWT_SECRET/);
});

test("configured frontend origins are trimmed and normalized", () => {
  assert.deepEqual(
    configuredClientOrigins({ CLIENT_ORIGIN: " https://a.example.org/ , https://b.example.org " }),
    ["https://a.example.org", "https://b.example.org"]
  );
});
