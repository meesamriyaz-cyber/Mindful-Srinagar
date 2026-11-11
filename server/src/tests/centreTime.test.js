import test from "node:test";
import assert from "node:assert/strict";
import { getCentreDayBounds } from "../security/centreTime.js";

test("centre day bounds follow Asia/Kolkata across UTC date boundaries", () => {
  const { start, end, monthStart } = getCentreDayBounds(new Date("2026-11-11T20:00:00.000Z"));
  assert.equal(start.toISOString(), "2026-11-11T18:30:00.000Z");
  assert.equal(end.toISOString(), "2026-11-12T18:30:00.000Z");
  assert.equal(monthStart.toISOString(), "2026-10-31T18:30:00.000Z");
});

test("centre day bounds handle the first day of a month", () => {
  const { start, end, monthStart } = getCentreDayBounds(new Date("2026-12-01T03:00:00.000Z"));
  assert.equal(start.toISOString(), "2026-11-30T18:30:00.000Z");
  assert.equal(end.toISOString(), "2026-12-01T18:30:00.000Z");
  assert.equal(monthStart.toISOString(), "2026-11-30T18:30:00.000Z");
});
