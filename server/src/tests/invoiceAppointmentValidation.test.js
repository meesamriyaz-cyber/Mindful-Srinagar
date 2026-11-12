import test from "node:test";
import assert from "node:assert/strict";
import { makeValidateInvoiceAppointmentLinks } from "../controllers/invoiceController.js";

const patientId = "64b000000000000000000001";
const appointmentId = "64b000000000000000000002";
const invoiceId = "64b000000000000000000003";

function query(value) {
  return {
    select() { return this; },
    lean() { return Promise.resolve(value); }
  };
}

function validator({ appointment, noteIds = [appointmentId], alreadyBilled = false } = {}) {
  const captured = {};
  const fn = makeValidateInvoiceAppointmentLinks({
    AppointmentModel: {
      find(filter) {
        captured.appointmentFilter = filter;
        return query(appointment === false ? [] : [appointment || { _id: appointmentId, patient: patientId, status: "completed" }]);
      }
    },
    ProgressNoteModel: {
      distinct(field, filter) {
        captured.noteFilter = { field, filter };
        return Promise.resolve(noteIds);
      }
    },
    InvoiceModel: {
      exists(filter) {
        captured.invoiceFilter = filter;
        return Promise.resolve(alreadyBilled ? { _id: invoiceId } : null);
      }
    }
  });
  return { fn, captured };
}

const items = [{ description: "Speech therapy session", quantity: 1, rate: 1000, appointment: appointmentId }];

test("session invoice validation accepts completed appointment with a linked session note", async () => {
  const { fn, captured } = validator();
  assert.equal(await fn(patientId, items), null);
  assert.deepEqual(captured.appointmentFilter, { _id: { $in: [appointmentId] } });
  assert.deepEqual(captured.noteFilter.filter, { appointment: { $in: [appointmentId] }, noteType: "session" });
});

test("session invoice validation rejects uncompleted or cross-patient appointments", async () => {
  const wrongPatient = validator({ appointment: { _id: appointmentId, patient: "64b000000000000000000009", status: "completed" } });
  assert.match(await wrongPatient.fn(patientId, items), /belong to the invoice patient/);
  const notCompleted = validator({ appointment: { _id: appointmentId, patient: patientId, status: "checked-in" } });
  assert.match(await notCompleted.fn(patientId, items), /completed appointments/);
  const missing = validator({ appointment: false });
  assert.match(await missing.fn(patientId, items), /could not be found/);
});

test("session invoice validation requires a note and rejects appointments already billed", async () => {
  const missingNote = validator({ noteIds: [] });
  assert.match(await missingNote.fn(patientId, items), /session note/);
  const billed = validator({ alreadyBilled: true });
  assert.match(await billed.fn(patientId, items), /already been billed/);
});

test("unlinked invoices remain supported for non-session charges", async () => {
  const { fn, captured } = validator();
  assert.equal(await fn(patientId, [{ description: "General administrative charge", quantity: 1, rate: 100 }]), null);
  assert.equal(captured.appointmentFilter, undefined);
});
