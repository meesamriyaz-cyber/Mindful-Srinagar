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
    if (!isValidObjectId(patientId) || !(await Patient.exists({ _id: patientId }))) throw httpError("Patient not found", 404);
  }
  async function validateRelated(payload) {
    if (validateRelations) await validateRelations(payload);
  }
  return {
    async list(req, res, next) {
      try {
        const { patientId, status, q, limit = 50, appointmentId } = req.query;
        const filter = {};
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
        await validateRelated(payload);
        const record = await Model.create({ ...payload, [ownerField]: req.user._id });
        return res.status(201).json(await populateQuery(Model.findById(record._id)));
      } catch (error) { return next(error); }
    },
    async get(req, res, next) {
      try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "A valid record ID is required" });
        const record = await populateQuery(Model.findById(req.params.id));
        if (!record) return res.status(404).json({ message: "Clinical record not found" });
        return res.json(record);
      } catch (error) { return next(error); }
    },
    async update(req, res, next) {
      try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "A valid record ID is required" });
        const payload = sanitizePayload(req.body, updateFields);
        const existing = await Model.findById(req.params.id);
        if (!existing) return res.status(404).json({ message: "Clinical record not found" });
        if (!privilegedRoles.includes(req.user.role) && String(existing[ownerField]) !== String(req.user._id)) {
          return res.status(403).json({ message: "Only the record author or an administrator can edit this record" });
        }
        if (existing.status === "completed" && !privilegedRoles.includes(req.user.role)) {
          return res.status(409).json({ message: "Completed clinical records require administrator review for amendments" });
        }
        await validateRelated({ ...existing.toObject(), ...payload });
        const record = await Model.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true, runValidators: true, context: "query" });
        return res.json(await populateQuery(Model.findById(record._id)));
      } catch (error) { return next(error); }
    }
  };
}
