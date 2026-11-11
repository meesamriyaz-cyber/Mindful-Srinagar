import test from "node:test";
import assert from "node:assert/strict";
import { permit } from "../middleware/auth.js";

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("doctor and therapist roles may access the practitioner dashboard", () => {
  for (const role of ["doctor", "therapist"]) {
    const res = response();
    let passed = false;
    permit("doctor", "therapist")({ user: { role } }, res, () => { passed = true; });
    assert.equal(passed, true, role);
    assert.equal(res.statusCode, 200, role);
  }
});

test("non-clinical staff cannot access the practitioner dashboard", () => {
  for (const role of ["director", "admin", "reception", "coordinator", "accounts"]) {
    const res = response();
    let passed = false;
    permit("doctor", "therapist")({ user: { role } }, res, () => { passed = true; });
    assert.equal(passed, false, role);
    assert.equal(res.statusCode, 403, role);
    assert.equal(res.body.message, "You do not have permission for this action");
  }
});
