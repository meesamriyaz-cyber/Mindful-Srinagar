import test from "node:test";
import assert from "node:assert/strict";
import { parseLimit, parseOffset } from "../utils/query.js";

test("pagination limit and offset are bounded and safe", () => {
  assert.equal(parseLimit("20"), 20);
  assert.equal(parseLimit("0"), 1);
  assert.equal(parseLimit("500"), 100);
  assert.equal(parseLimit("bad"), 50);
  assert.equal(parseOffset("40"), 40);
  assert.equal(parseOffset("-4"), 0);
  assert.equal(parseOffset("2000000"), 1000000);
  assert.equal(parseOffset("bad"), 0);
});
