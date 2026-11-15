import test from "node:test";
import assert from "node:assert/strict";
import { createPasswordResetToken, hashPasswordResetToken, PASSWORD_RESET_TTL_MS } from "../security/passwordResetTokens.js";

test("password reset tokens are cryptographically random and URL-safe hex strings", () => {
  const first = createPasswordResetToken();
  const second = createPasswordResetToken();
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
});

test("password reset token hashes are one-way SHA-256 digests", () => {
  const token = createPasswordResetToken();
  const digest = hashPasswordResetToken(token);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.notEqual(digest, token);
  assert.equal(hashPasswordResetToken(token), digest);
});

test("password reset links expire after 30 minutes", () => {
  assert.equal(PASSWORD_RESET_TTL_MS, 30 * 60 * 1000);
});
