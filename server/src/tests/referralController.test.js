import test from "node:test";
import assert from "node:assert/strict";
import { makeLogReferralFollowUp } from "../controllers/referralController.js";

const referralId = "64b000000000000000000001";
const actorId = "64b000000000000000000002";

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

function makeReferral(status = "new") {
  return {
    _id: referralId,
    status,
    followUpDate: new Date("2026-11-16T11:30:00.000Z"),
    followUpHistory: [],
    saved: false,
    async save() { this.saved = true; },
    async populate() { return this; }
  };
}

test("follow-up endpoint appends an immutable actor-stamped contact event and schedules next action", async () => {
  const referral = makeReferral();
  const handler = makeLogReferralFollowUp({ findById: async () => referral });
  const res = makeResponse();
  await handler({
    params: { id: referralId },
    user: { _id: actorId },
    body: {
      contactMethod: "whatsapp",
      outcome: "no-answer",
      note: "Guardian did not answer; try again tomorrow.",
      nextFollowUpAt: "2026-11-17T11:30:00.000Z"
    }
  }, res, assert.fail);

  assert.equal(res.statusCode, 201);
  assert.equal(referral.status, "contacted");
  assert.equal(referral.followUpHistory.length, 1);
  assert.equal(String(referral.followUpHistory[0].loggedBy), actorId);
  assert.equal(referral.followUpHistory[0].outcome, "no-answer");
  assert.equal(referral.followUpDate.toISOString(), "2026-11-17T11:30:00.000Z");
  assert.equal(referral.saved, true);
});

test("appointment-booked and not-interested outcomes close the follow-up loop correctly", async () => {
  const scheduled = makeReferral("contacted");
  const scheduleHandler = makeLogReferralFollowUp({ findById: async () => scheduled });
  const scheduleResponse = makeResponse();
  await scheduleHandler({
    params: { id: referralId }, user: { _id: actorId },
    body: { contactMethod: "phone", outcome: "appointment-booked", note: "Assessment appointment confirmed." }
  }, scheduleResponse, assert.fail);
  assert.equal(scheduleResponse.statusCode, 201);
  assert.equal(scheduled.status, "scheduled");
  assert.equal(scheduled.followUpDate, undefined);

  const declined = makeReferral("contacted");
  const declineHandler = makeLogReferralFollowUp({ findById: async () => declined });
  const declineResponse = makeResponse();
  await declineHandler({
    params: { id: referralId }, user: { _id: actorId },
    body: { contactMethod: "phone", outcome: "not-interested", note: "Family declined further contact." }
  }, declineResponse, assert.fail);
  assert.equal(declineResponse.statusCode, 201);
  assert.equal(declined.status, "lost");
  assert.equal(declined.followUpDate, undefined);
});

test("follow-up endpoint rejects closed referrals and invalid event payloads", async () => {
  const closedHandler = makeLogReferralFollowUp({ findById: async () => makeReferral("converted") });
  const closedResponse = makeResponse();
  await closedHandler({
    params: { id: referralId }, user: { _id: actorId },
    body: { contactMethod: "phone", outcome: "appointment-booked", note: "Booked." }
  }, closedResponse, assert.fail);
  assert.equal(closedResponse.statusCode, 409);

  const invalidHandler = makeLogReferralFollowUp({ findById: async () => makeReferral() });
  const invalidResponse = makeResponse();
  await invalidHandler({
    params: { id: referralId }, user: { _id: actorId },
    body: { contactMethod: "fax", outcome: "reached", note: "Reached." }
  }, invalidResponse, assert.fail);
  assert.equal(invalidResponse.statusCode, 400);
});
