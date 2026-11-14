import mongoose from "mongoose";
import { Patient } from "../models/Patient.js";
import { ClinicalRecordAmendment } from "../models/ClinicalRecordAmendment.js";
import { escapeRegex, isValidObjectId, parseLimit, parseOffset, sanitizePayload } from "../utils/query.js";
import { canTransitionClinicalStatus, validateAmendmentInput } from "../security/clinicalRecordRules.js";
const privilegedRoles = ["director", "admin"];
function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
export function makeClinicalRecordController({
  Model, recordType, ownerField, createFields, updateFields, populate = [], sortField, searchFields = [], defaultValues = {}, validateRelations
}) {
  const populateQuery = (query) => populate.reduce((current, instruction) => {
    if (Array.isArray(instruction)) {
      const [path, select] = instruction;
      return current.populate(path, select);
    }
    return current.populate(instruction);
  }, query);
  const amendmentFields = updateFields.filter((field) => field !== "status");
  async function validatePatient(patientId) {
    if (!isValidObjectId(patientId)) throw httpError("A valid patient ID is required", 400);
    const patient = await Patient.findById(patientId).select("status");
    if (!patient) throw httpError("Patient not found", 404);
    if (["on-hold", "discharged"].includes(patient.status)) throw httpError("Clinical records cannot be added or changed while the patient is on hold or discharged", 409);
  }
  function ownerFilter(req) {
    return privilegedRoles.includes(req.user.role) ? {} : { [ownerField]: req.user._id };
  }
  async function validateRelated(payload, req) {
    if (validateRelations) await validateRelations(payload, req);
  }
  return {
    async list(req, res, next) {
      try {
        const { patientId, status, q, limit = 50, skip = 0, appointmentId } = req.query;
        const filter = { ...ownerFilter(req) };
        if (patientId) {
          if (!isValidObjectId(patientId)) return res.status(400).json({ message: "A valid patient ID is required" });
          filter.patient = patientId;
        }
        if (appointmentId) {
          if (!isValidObjectId(appointmentId)) return res.status(400).json({ message: "A valid appointment ID is required" });
          filter.appointment = appointmentId;
        }
        if (status) filter.status = status;
        if (q) {
          const expression = new RegExp(escapeRegex(String(q).trim().slice(0, 80)), "i");
          filter.$or = searchFields.map((field) => ({ [field]: expression }));
        }
        const pageSize = parseLimit(limit);
        const offset = parseOffset(skip);
        const [total, records] = await Promise.all([
          Model.countDocuments(filter),
          populateQuery(Model.find(filter)).sort({ [sortField]: -1, _id: -1 }).skip(offset).limit(pageSize)
        ]);
        res.set("X-Total-Count", String(total));
        res.set("X-Has-More", String(offset + records.length < total));
        res.set("X-Next-Offset", String(offset + records.length));
        return res.json(records);
      } catch (error) { return next(error); }
    },
    async create(req, res, next) {
      try {
        const defaults = typeof defaultValues === "function" ? defaultValues() : defaultValues;
        const payload = { ...defaults, ...sanitizePayload(req.body, createFields) };
        await validatePatient(payload.patient);
        await validateRelated(payload, req);
        const record = await Model.create({ ...payload, [ownerField]: req.user._id });
        return res.status(201).json(await populateQuery(Model.findById(record._id)));
      } catch (error) { return next(error); }
    },
    async get(req, res, next) {
      try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "A valid record ID is required" });
        const record = await populateQuery(Model.findOne({ _id: req.params.id, ...ownerFilter(req) }));
        if (!record) return res.status(404).json({ message: "Clinical record not found" });
        return res.json(record);
      } catch (error) { return next(error); }
    },
    async update(req, res, next) {
      try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "A valid record ID is required" });
        const payload = sanitizePayload(req.body, updateFields);
        const existing = await Model.findOne({ _id: req.params.id, ...ownerFilter(req) });
        if (!existing) return res.status(404).json({ message: "Clinical record not found" });
        if (existing.status === "completed" || recordType === "progress-note") return res.status(409).json({ message: "Completed clinical records are immutable. Use the authorised amendment workflow with a reason." });
        if (payload.status && !canTransitionClinicalStatus(recordType, existing.status, payload.status)) return res.status(409).json({ message: "Invalid clinical record status transition" });
        if (String(existing[ownerField]) !== String(req.user._id) && !privilegedRoles.includes(req.user.role)) {
          return res.status(403).json({ message: "Only the record author or an administrator can edit this record" });
        }
        if (payload.patient && String(payload.patient) !== String(existing.patient)) return res.status(400).json({ message: "A clinical record cannot be reassigned to another patient" });
        await validatePatient(existing.patient);
        await validateRelated({ ...existing.toObject(), ...payload }, req);
        const record = await Model.findOneAndUpdate({ _id: req.params.id, ...ownerFilter(req) }, { $set: payload }, { new: true, runValidators: true, context: "query" });
        return res.json(await populateQuery(Model.findById(record._id)));
      } catch (error) { return next(error); }
    },
    async amendments(req, res, next) {
      try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "A valid record ID is required" });
        const record = await Model.findOne({ _id: req.params.id, ...ownerFilter(req) }).select("_id");
        if (!record) return res.status(404).json({ message: "Clinical record not found" });
        const history = await ClinicalRecordAmendment.find({ recordType, recordId: record._id })
          .populate("amendedBy", "name email").sort({ createdAt: -1 }).limit(100).lean();
        return res.json(history);
      } catch (error) { return next(error); }
    },
    async amend(req, res, next) {
      let session;
      try {
        if (!privilegedRoles.includes(req.user.role)) return res.status(403).json({ message: "Only a director or administrator may amend completed clinical records" });
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "A valid record ID is required" });
        const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
        const reason = typeof body.reason === "string" ? body.reason.trim() : "";
        const inputError = validateAmendmentInput({ reason, changes: body.changes, allowedFields: amendmentFields });
        if (inputError) return res.status(400).json({ message: inputError });
        const changes = sanitizePayload(body.changes, amendmentFields);
        const existing = await Model.findById(req.params.id);
        if (!existing) return res.status(404).json({ message: "Clinical record not found" });
        if (existing.status !== "completed" && recordType !== "progress-note") return res.status(409).json({ message: "The amendment workflow is only for completed records" });
        if (changes.patient && String(changes.patient) !== String(existing.patient)) return res.status(400).json({ message: "A clinical record cannot be reassigned to another patient" });
        await validatePatient(existing.patient);
        await validateRelated({ ...existing.toObject(), ...changes }, req);
        const before = {};
        const after = {};
        for (const field of Object.keys(changes)) {
          before[field] = existing.get(field);
          after[field] = changes[field];
        }
        session = await mongoose.startSession();
        await session.withTransaction(async () => {
          await ClinicalRecordAmendment.create([{
            recordType, recordId: existing._id, patient: existing.patient, amendedBy: req.user._id,
            reason, changedFields: Object.keys(changes), before, after
          }], { session });
          const result = await Model.updateOne(
            { _id: existing._id, ...(recordType === "progress-note" ? {} : { status: "completed" }), __v: existing.__v },
            { $set: changes, $inc: { __v: 1 } },
            { session, runValidators: true }
          );
          if (result.modifiedCount !== 1) throw httpError("The record changed during this amendment. Reload and try again.", 409);
        });
        const updated = await populateQuery(Model.findById(existing._id));
        return res.json({ record: updated, message: "Amendment recorded in the clinical audit history" });
      } catch (error) { return next(error); }
      finally { if (session) await session.endSession(); }
    }
  };
}
