import test from "node:test";
import assert from "node:assert/strict";
import { getNextWorkingDayDeadline, isReferralFollowUpOverdue, validateReferralFollowUp } from "../security/referralRules.js";

test("referral follow-up deadline is the next working day at 5 PM India time", () => {
  const friday = new Date("2026-11-13T05:00:00.000Z");
  assert.equal(getNextWorkingDayDeadline(friday).toISOString(), "2026-11-16T11:30:00.000Z");

  const saturday = new Date("2026-11-14T05:00:00.000Z");
  assert.equal(getNextWorkingDayDeadline(saturday).toISOString(), "2026-11-16T11:30:00.000Z");
});

test("referral follow-up deadline respects India local date around UTC midnight", () => {
  const utcPreviousDay = new Date("2026-11-12T20:00:00.000Z");
  assert.equal(getNextWorkingDayDeadline(utcPreviousDay).toISOString(), "2026-11-13T11:30:00.000Z");
});

test("open referral is overdue only after its follow-up deadline", () => {
  const now = new Date("2026-11-12T12:00:00.000Z");
  assert.equal(isReferralFollowUpOverdue({ status: "new", followUpDate: "2026-11-12T11:59:00.000Z" }, now), true);
  assert.equal(isReferralFollowUpOverdue({ status: "converted", followUpDate: "2026-11-12T11:00:00.000Z" }, now), false);
  assert.equal(isReferralFollowUpOverdue({ status: "new" }, now), false);
});

test("follow-up log validates contact method, outcome and note", () => {
  assert.equal(validateReferralFollowUp({
    contactMethod: "whatsapp",
    outcome: "reached",
    note: "Spoke with the patient's guardian."
  }), null);
  assert.match(validateReferralFollowUp({ contactMethod: "fax", outcome: "reached", note: "Spoke" }), /contact method/);
  assert.match(validateReferralFollowUp({ contactMethod: "phone", outcome: "unknown", note: "Spoke" }), /outcome/);
  assert.match(validateReferralFollowUp({ contactMethod: "phone", outcome: "reached", note: " " }), /follow-up note/);
});
