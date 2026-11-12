import test from "node:test";
import assert from "node:assert/strict";
import { makeCrudController } from "../controllers/crudController.js";

function makeQuery(records, captured) {
  return {
    populate() { return this; },
    sort(value) { captured.sort = value; return this; },
    skip(value) { captured.skip = value; return this; },
    limit(value) { captured.limit = value; return Promise.resolve(records); }
  };
}

function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    set(name, value) { this.headers[name] = value; return this; },
    json(value) { this.body = value; return this; }
  };
}

test("generic resource list returns stable offset pages and total metadata", async () => {
  const captured = {};
  const docs = [{ _id: "r3" }, { _id: "r2" }];
  const Model = {
    find(filter) { captured.filter = filter; return makeQuery(docs, captured); },
    countDocuments(filter) { captured.countFilter = filter; return Promise.resolve(5); }
  };
  const controller = makeCrudController(Model, [], {
    filterFields: ["status", "patient"],
    filterAliases: { patientId: "patient" },
    searchableFields: ["title"]
  });
  const res = makeResponse();
  await controller.list({ query: { status: "active", patientId: "p1", q: "speech", limit: "2", skip: "2" }, user: { role: "admin" } }, res, assert.fail);

  assert.deepEqual(captured.filter.status, "active");
  assert.deepEqual(captured.filter.patient, "p1");
  assert.equal(captured.skip, 2);
  assert.equal(captured.limit, 2);
  assert.deepEqual(captured.sort, { createdAt: -1, _id: -1 });
  assert.equal(res.headers["X-Total-Count"], "5");
  assert.equal(res.headers["X-Has-More"], "true");
  assert.equal(res.headers["X-Next-Offset"], "4");
  assert.deepEqual(res.body, docs);
});

test("generic resource list rejects unsupported filters even with pagination", async () => {
  const Model = {
    find() { return makeQuery([], {}); },
    countDocuments() { return Promise.resolve(0); }
  };
  const controller = makeCrudController(Model, [], { filterFields: ["status"] });
  const res = makeResponse();
  await controller.list({ query: { skip: "20", patientName: "Aarav" }, user: { role: "admin" } }, res, assert.fail);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Unsupported filter/);
});
