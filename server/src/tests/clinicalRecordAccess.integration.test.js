import test from "node:test";
import assert from "node:assert/strict";
import { makeClinicalRecordController } from "../controllers/clinicalRecordController.js";

function queryResult(value) {
  return {
    populate() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
  };
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    set() { return this; },
    json(value) { this.body = value; return this; }
  };
}

test("clinical list is scoped to the authenticated record author", async () => {
  let captured;
  const Model = {
    find(filter) { captured = filter; return queryResult([]); },
    countDocuments() { return Promise.resolve(0); }
  };
  const controller = makeClinicalRecordController({
    Model, ownerField: "assessedBy", createFields: [], updateFields: [], sortField: "assessedAt"
  });
  const res = response();
  await controller.list({ query: {}, user: { _id: "staff-123", role: "therapist" } }, res, assert.fail);
  assert.deepEqual(captured, { assessedBy: "staff-123" });
  assert.deepEqual(res.body, []);
});

test("clinical single-record retrieval cannot escape author scope", async () => {
  let captured;
  const Model = {
    findOne(filter) { captured = filter; return queryResult(null); }
  };
  const controller = makeClinicalRecordController({
    Model, ownerField: "author", createFields: [], updateFields: [], sortField: "notedAt"
  });
  const res = response();
  await controller.get({
    params: { id: "64b000000000000000000001" },
    user: { _id: "staff-456", role: "doctor" }
  }, res, assert.fail);
  assert.deepEqual(captured, { _id: "64b000000000000000000001", author: "staff-456" });
  assert.equal(res.statusCode, 404);
});

test("director clinical retrieval is not restricted to an individual author", async () => {
  let captured;
  const Model = {
    findOne(filter) { captured = filter; return queryResult({ _id: "64b000000000000000000001" }); }
  };
  const controller = makeClinicalRecordController({
    Model, ownerField: "author", createFields: [], updateFields: [], sortField: "notedAt"
  });
  const res = response();
  await controller.get({
    params: { id: "64b000000000000000000001" },
    user: { _id: "director-1", role: "director" }
  }, res, assert.fail);
  assert.deepEqual(captured, { _id: "64b000000000000000000001" });
  assert.equal(res.statusCode, 200);
});
