import test from "node:test";
import assert from "node:assert/strict";
import { escapeRegex, parseLimit, sanitizePayload } from "../utils/query.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
import { permit } from "../middleware/auth.js";
import { Invoice } from "../models/Invoice.js";

test("payload sanitizer permits allowlisted fields only", () => {
  assert.deepEqual(sanitizePayload({ fullName: "Sample", phone: "1234567" }, ["fullName", "phone"]), {
    fullName: "Sample", phone: "1234567"
  });
});
test("payload sanitizer rejects mass assignment and malformed bodies", () => {
  assert.throws(() => sanitizePayload({ role: "director", isActive: true }, ["name"]), /Unsupported field/);
  assert.throws(() => sanitizePayload(["invalid"], ["name"]), /JSON object/);
});
test("query helpers escape regex and clamp limits", () => {
  assert.equal(escapeRegex("a+b?"), "a\\+b\\?");
  assert.equal(parseLimit("999"), 100);
  assert.equal(parseLimit("-2"), 1);
  assert.equal(parseLimit("invalid"), 50);
});
test("rate limiter rejects requests above the configured threshold", () => {
  const limiter = createRateLimiter({ windowMs: 60000, max: 1, message: "slow down" });
  const response = () => ({
    statusCode: 200, body: null,
    setHeader() { return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  });
  let passed = 0;
  limiter({ ip: "security-test-ip" }, response(), () => { passed += 1; });
  const second = response();
  limiter({ ip: "security-test-ip" }, second, () => { passed += 1; });
  assert.equal(passed, 1);
  assert.equal(second.statusCode, 429);
  assert.equal(second.body.message, "slow down");
});
test("role middleware rejects unauthorized roles", () => {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  permit("director", "admin")({ user: { role: "reception" } }, res, () => assert.fail("next must not run"));
  assert.equal(res.statusCode, 403);
});
test("invoice validation rejects discount above subtotal", async () => {
  const invoice = new Invoice({
    patient: "64b000000000000000000001", invoiceNo: "TEST-INV-DISCOUNT",
    items: [{ description: "Service", quantity: 2, rate: 500 }], discount: 1200
  });
  await assert.rejects(invoice.validate(), (error) => Boolean(error.errors?.discount));
});
test("invoice validation rejects payment above total", async () => {
  const invoice = new Invoice({
    patient: "64b000000000000000000001", invoiceNo: "TEST-INV-PAYMENT",
    items: [{ description: "Service", quantity: 1, rate: 500 }], paidAmount: 600
  });
  await assert.rejects(invoice.validate(), (error) => Boolean(error.errors?.paidAmount));
});
