import { TreatmentPlan } from "../models/TreatmentPlan.js";
import { Patient } from "../models/Patient.js";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 50;
  return Math.min(Math.max(parsed, 1), 100);
}

export async function listTreatmentPlans(req, res, next) {
  try {
    const { patientId, status, q, limit = 50 } = req.query;
    const filter = {};
    if (patientId) filter.patient = patientId;
    if (status) filter.status = status;

    let query = TreatmentPlan.find(filter)
      .populate("patient", "fullName mrn")
      .populate("createdBy", "name email");

    if (q) {
      const safeQuery = escapeRegex(String(q).trim().slice(0, 80));
      const expression = new RegExp(safeQuery, "i");
      query = TreatmentPlan.find({
        ...filter,
        $or: [
          { goals: expression },
          { interventions: expression },
          { "patient.fullName": expression },
          { "patient.mrn": expression }
        ]
      })
        .populate("patient", "fullName mrn")
        .populate("createdBy", "name email");
    }

    const docs = await query.sort({ startDate: -1 }).limit(parseLimit(limit));
    res.json(docs);
  } catch (error) {
    next(error);
  }
}

export async function createTreatmentPlan(req, res, next) {
  try {
    const patient = await Patient.findById(req.body.patient);
    if (!patient) {
      res.status(404);
      throw new Error("Patient not found");
    }
    const doc = await TreatmentPlan.create({
      ...req.body,
      createdBy: req.user._id
    });
    const populated = await TreatmentPlan.findById(doc._id)
      .populate("patient", "fullName mrn")
      .populate("createdBy", "name email");
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
}

export async function getTreatmentPlan(req, res, next) {
  try {
    const doc = await TreatmentPlan.findById(req.params.id)
      .populate("patient", "fullName mrn guardianName phone")
      .populate("createdBy", "name email");
    if (!doc) {
      res.status(404);
      throw new Error("Treatment plan not found");
    }
    res.json(doc);
  } catch (error) {
    next(error);
  }
}

export async function updateTreatmentPlan(req, res, next) {
  try {
    const doc = await TreatmentPlan.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true, context: "query" }
    )
      .populate("patient", "fullName mrn")
      .populate("createdBy", "name email");
    if (!doc) {
      res.status(404);
      throw new Error("Treatment plan not found");
    }
    res.json(doc);
  } catch (error) {
    next(error);
  }
}
