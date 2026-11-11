import test from "node:test";
import assert from "node:assert/strict";
import { createPractitionerPatientScope } from "../security/practitionerPatientScope.js";

function doctorQuery(value) {
  return { select() { return this; }, lean: async () => value };
}

test("clinician patient scope contains only patients with non-cancelled assigned appointments", async () => {
  let captured;
  const scope = createPractitionerPatientScope({
    Doctor: { findOne: (filter) => { assert.deepEqual(filter, { user: "staff-1", status: { $ne: "inactive" } }); return doctorQuery({ _id: "practitioner-1" }); } },
    Appointment: { distinct: async (field, filter) => { assert.equal(field, "patient"); captured = filter; return ["patient-1", "patient-2"]; } }
  });
  const result = await scope({ user: { _id: "staff-1", role: "doctor" } });
  assert.deepEqual(captured, { practitioner: "practitioner-1", status: { $nin: ["cancelled", "no-show"] } });
  assert.deepEqual(result, { _id: { $in: ["patient-1", "patient-2"] } });
});

test("unlinked clinicians receive an empty patient scope", async () => {
  const scope = createPractitionerPatientScope({
    Doctor: { findOne: () => doctorQuery(null) },
    Appointment: { distinct: async () => assert.fail("must not query appointments without a practitioner") }
  });
  assert.deepEqual(await scope({ user: { _id: "staff-2", role: "therapist" } }), { _id: { $in: [] } });
});

test("non-clinical roles retain their existing patient scope", async () => {
  const scope = createPractitionerPatientScope({
    Doctor: { findOne: () => assert.fail("must not query practitioner") },
    Appointment: { distinct: () => assert.fail("must not query appointments") }
  });
  assert.deepEqual(await scope({ user: { _id: "admin-1", role: "admin" } }), {});
});
