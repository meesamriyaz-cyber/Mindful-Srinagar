import { Patient } from "../models/Patient.js";
import { escapeRegex, isValidObjectId, parseLimit, sanitizePayload } from "../utils/query.js";
const privilegedRoles = ["director", "admin"];
function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
export function makeClinicalRecordController({
  Model, ownerField, createFields, updateFields, populate = [], sortField, searchFields = [], defaultValues = {}, validateRelations
}) {
  const populateQuery = (query) => populate.reduce((current, path) => current.populate(path), query);
  async function validatePatient(patientId) {
    if (!isValidObjectId(patientId)) throw httpError("A valid patient ID is required", 400);
    const patient = await Patient.findById(patientId).select("status");
    if (!patient) throw httpError("Patient not found", 404);
    if (["on-hold", "discharged"].includes(patient.status)) {
      throw httpError("Clinical records cannot be added or changed while the patient is on hold or discharged", 409);
    }
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
        const { patientId, status, q, limit = 50, appointmentId } = req.query;
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
        return res.json(await populateQuery(Model.find(filter)).sort({ [sortField]: -1 }).limit(parseLimit(limit)));
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
        if (!privilegedRoles.includes(req.user.role) && String(existing[ownerField]) !== String(req.user._id)) {
          return res.status(403).json({ message: "Only the record author or an administrator can edit this record" });
        }
        if (existing.status === "completed" && !privilegedRoles.includes(req.user.role)) {
          return res.status(409).json({ message: "Completed clinical records require administrator review for amendments" });
        }
        if (payload.patient && String(payload.patient) !== String(existing.patient)) {
          return res.status(400).json({ message: "A clinical record cannot be reassigned to another patient" });
        }
        await validatePatient(existing.patient);
        await validateRelated({ ...existing.toObject(), ...payload }, req);
        const record = await Model.findOneAndUpdate({ _id: req.params.id, ...ownerFilter(req) }, { $set: payload }, { new: true, runValidators: true, context: "query" });
        return res.json(await populateQuery(Model.findById(record._id)));
      } catch (error) { return next(error); }
    }
  };
}
